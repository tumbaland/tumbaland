import Trade, { TradeType } from '../models/Trade';
import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import { tenantScope } from '../utils/scope';
import { fold, StatementRow } from './bankStatement.service';
import { syncHoldingFromTrades } from './trade.service';
import type { ImportOptions } from './importTypes';

/**
 * Turns the securities rows of a bank statement into entries of the trade log.
 *
 * The cash-flow import records that money left the account; this records what
 * it bought. Without it a settlement or a dividend sits in the statement as a
 * cash row and the position, its cost basis and the dividends it paid never
 * hear about it.
 */

export interface TradeImportResult {
  /** Trades newly written to the log. */
  imported: number;
  /** Rows the log already held, from an earlier import or entered by hand. */
  alreadyRecorded: number;
  /** Rows that could not be placed, grouped by what was missing. */
  unmatched: Array<{ what: string; count: number }>;
  /**
   * Tickers that gained trades but whose holding was left as it was: the
   * holding was entered by hand with no history behind it, and replaying only
   * the imported trades would have overwritten it with a fraction of the
   * position.
   */
  holdingsLeftAlone: string[];
}

export const EMPTY_TRADE_IMPORT: TradeImportResult = {
  imported: 0,
  alreadyRecorded: 0,
  unmatched: [],
  holdingsLeftAlone: []
};

export interface TradeRow {
  row: StatementRow;
  kind: 'security' | 'dividend';
}

/** A payout can be booked a few days either side of the date it was recorded by hand. */
const DIVIDEND_WINDOW_DAYS = 3;
const DAY_MS = 86_400_000;

interface ParsedSettlement {
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
}

/** What the bank calls each side, in either language it writes them in. */
const SIDES: Record<string, 'buy' | 'sell'> = {
  buy: 'buy',
  ost: 'buy',
  sale: 'sell',
  sell: 'sell',
  muuk: 'sell'
};

/**
 * `DLA1164839/EXUS GY/100/39.7/Ost/ Saksamaa börsid` — reference, symbol with an
 * optional exchange code, quantity, price, side. Older rows have no exchange
 * code and a purely numeric reference.
 */
const SETTLEMENT = /^DL[A-Z0-9]+\/([A-Z0-9.]+)(?: [A-Z]{2})?\/([\d.]+)\/([\d.]+)\/([^/]+)\//i;

export function parseSettlement(description: string): ParsedSettlement | null {
  const match = SETTLEMENT.exec(description.trim());
  if (!match) return null;

  const type = SIDES[fold(match[4]).trim().toLowerCase()];
  const quantity = parseFloat(match[2]);
  const price = parseFloat(match[3]);
  if (!type || !(quantity > 0) || !(price >= 0)) return null;

  return { symbol: match[1].toUpperCase(), type, quantity, price };
}

const ISIN = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/;

/** The ISIN a dividend row names the fund by, e.g. `Vanguard,IE00B3XXRP09,dividendimakse,...`. */
export function parseDividendIsin(description: string): string | null {
  const match = ISIN.exec(description.toUpperCase());
  return match ? match[1] : null;
}

const day = (date: Date) => date.toISOString().slice(0, 10);
const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-6;

interface Wanted {
  ticker: string;
  type: TradeType;
  date: Date;
  quantity: number;
  price: number;
  amount: number;
  externalId: string;
}

/** What is already in the log for one ticker, so a row is not recorded twice. */
interface Held {
  _id: unknown;
  ticker: string;
  type: TradeType;
  date: Date;
  quantity: number;
  price: number;
  amount: number;
  externalId?: string;
}

const matchesExisting = (wanted: Wanted, held: Held): boolean => {
  if (held.type !== wanted.type) return false;
  if (wanted.type === 'dividend') {
    return Math.abs(+held.date - +wanted.date) <= DIVIDEND_WINDOW_DAYS * DAY_MS;
  }
  return (
    day(held.date) === day(wanted.date) &&
    sameNumber(held.quantity, wanted.quantity) &&
    sameNumber(held.price, wanted.price)
  );
};

export async function importTrades(
  tradeRows: TradeRow[],
  options: ImportOptions
): Promise<TradeImportResult> {
  if (tradeRows.length === 0) return { ...EMPTY_TRADE_IMPORT, unmatched: [], holdingsLeftAlone: [] };

  const groups = options.groupId ? [options.groupId] : [];
  const scope = tenantScope(options.userId, groups);

  const [tracked, holdings, tradedTickers] = await Promise.all([
    TrackedTicker.find(scope).lean(),
    Holding.find(scope, { ticker: 1 }).lean(),
    Trade.distinct('ticker', scope)
  ]);

  const known = new Set<string>(
    [...tracked.map((t) => t.ticker), ...holdings.map((h) => h.ticker), ...tradedTickers].map((t) =>
      String(t).toUpperCase()
    )
  );
  const holdingTickers = new Set(holdings.map((h) => String(h.ticker).toUpperCase()));
  const byIsin = new Map<string, string>();
  for (const t of tracked) if (t.isin) byIsin.set(t.isin.toUpperCase(), t.ticker.toUpperCase());

  /** `VUSA` → `VUSA.DEX`, provided exactly one known ticker starts that way. */
  const bySymbol = (symbol: string): string | null => {
    const hits = [...known].filter((t) => t === symbol || t.startsWith(`${symbol}.`));
    return hits.length === 1 ? hits[0] : null;
  };

  const unmatched = new Map<string, number>();
  const miss = (what: string) => unmatched.set(what, (unmatched.get(what) || 0) + 1);

  const wanted: Wanted[] = [];
  const seen = new Set<string>();

  for (const { row, kind } of tradeRows) {
    if (!row.externalId) { miss('No archive reference — cannot be de-duplicated'); continue; }
    if (!row.date) { miss(`Unreadable date "${row.dateText}"`); continue; }
    if (!Number.isFinite(row.amount) || row.amount <= 0) { miss('Unreadable or zero amount'); continue; }
    if (row.currency !== 'EUR') { miss(`Not in EUR (${row.currency})`); continue; }
    if (seen.has(row.externalId)) continue;
    seen.add(row.externalId);

    if (kind === 'dividend') {
      const isin = parseDividendIsin(row.description);
      if (!isin) { miss('Dividend with no ISIN in the description'); continue; }
      const ticker = byIsin.get(isin);
      if (!ticker) { miss(`Dividend for ${isin}: no ticker has that ISIN`); continue; }
      wanted.push({
        ticker, type: 'dividend', date: row.date, quantity: 0, price: 0,
        amount: row.amount, externalId: row.externalId
      });
      continue;
    }

    const parsed = parseSettlement(row.description);
    if (!parsed) { miss('Securities row in a shape not recognised'); continue; }
    const ticker = bySymbol(parsed.symbol);
    if (!ticker) { miss(`${parsed.symbol}: no single tracked ticker or holding matches`); continue; }
    wanted.push({
      ticker, type: parsed.type, date: row.date, quantity: parsed.quantity, price: parsed.price,
      amount: 0, externalId: row.externalId
    });
  }

  const tickers = [...new Set(wanted.map((w) => w.ticker))];
  const existing = (tickers.length === 0
    ? []
    : await Trade.find({
        ...scope,
        $or: [{ ticker: { $in: tickers } }, { externalId: { $in: wanted.map((w) => w.externalId) } }]
      }).lean()) as unknown as Held[];

  const heldIds = new Set(existing.map((h) => h.externalId).filter(Boolean));
  const byTicker = new Map<string, Held[]>();
  for (const h of existing) byTicker.set(h.ticker, [...(byTicker.get(h.ticker) || []), h]);
  const hadTrades = new Set(existing.map((h) => h.ticker));

  const claimed = new Set<unknown>();
  const adopt: Array<{ id: unknown; externalId: string }> = [];
  const fresh: Wanted[] = [];
  let alreadyRecorded = 0;

  for (const w of wanted) {
    if (heldIds.has(w.externalId)) { alreadyRecorded++; continue; }

    // A trade entered by hand carries no reference. Recognise it by what it
    // says and give it the reference, so the next import finds it directly.
    const twin = (byTicker.get(w.ticker) || []).find(
      (h) => !h.externalId && !claimed.has(h._id) && matchesExisting(w, h)
    );
    if (twin) {
      claimed.add(twin._id);
      adopt.push({ id: twin._id, externalId: w.externalId });
      alreadyRecorded++;
      continue;
    }
    fresh.push(w);
  }

  const operations = [
    ...adopt.map((a) => ({
      updateOne: { filter: { _id: a.id }, update: { $set: { externalId: a.externalId } } }
    })),
    ...fresh.map((w) => ({
      updateOne: {
        filter: { userId: options.userId, externalId: w.externalId },
        update: {
          $setOnInsert: {
            ticker: w.ticker,
            type: w.type,
            date: w.date,
            quantity: w.quantity,
            price: w.price,
            amount: w.amount,
            fees: 0,
            notes: 'Imported from SEB statement',
            externalId: w.externalId,
            userId: options.userId,
            ...(options.groupId ? { groupId: options.groupId } : {})
          }
        },
        upsert: true
      }
    }))
  ];
  if (operations.length > 0) await Trade.bulkWrite(operations as never, { ordered: false });

  // The holding follows the log only where the log was already its source of
  // truth, or there is no holding to protect.
  const holdingsLeftAlone: string[] = [];
  for (const ticker of new Set(fresh.map((w) => w.ticker))) {
    if (hadTrades.has(ticker) || !holdingTickers.has(ticker)) {
      await syncHoldingFromTrades(ticker, options.userId, groups, options.groupId);
    } else {
      holdingsLeftAlone.push(ticker);
    }
  }

  return {
    imported: fresh.length,
    alreadyRecorded,
    unmatched: [...unmatched.entries()].map(([what, count]) => ({ what, count })),
    holdingsLeftAlone
  };
}
