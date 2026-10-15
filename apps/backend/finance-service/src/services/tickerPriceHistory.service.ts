import TickerPriceHistory, { PriceInterval } from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';
import { fetchStockPrice, fetchAndSaveAllStockHistory, fetchAndSaveWeeklyHistory } from './alphaVantage.service';
import { BadRequestError, ForbiddenError } from '@tumbaland/backend-core';

interface TickerPriceResponse {
  _id?: string;
  date: string;
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface PriceHistoryQuery {
  ticker?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  /**
   * Which series to read. Defaults to `daily`, so every existing caller keeps
   * the series it was written against — weekly rows are opt-in, and the two are
   * never mixed: annualizing a weekly return as a daily one inflates it about
   * fivefold.
   */
  interval?: PriceInterval;
  /**
   * Oldest date the caller's plan permits, or `null` for unlimited. Applied as a
   * floor *underneath* `from`, so a caller can narrow their window but never
   * widen it past what they are entitled to.
   */
  retentionFrom?: Date | null;
}

/** Cap on rows returned in one call, and the default when no limit is given. */
export const MAX_PRICE_HISTORY_LIMIT = 5000;
export const DEFAULT_PRICE_HISTORY_LIMIT = 1000;

// Normalizes to the UTC midnight boundary for the given day, so the same
// value can be used in both the upsert filter and the written document —
// writing the untruncated "now" timestamp while filtering on the
// date-only string previously meant the filter could never match what a
// prior run had written, and every call inserted a duplicate row instead
// of updating one.
function toUtcDateOnly(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10));
}

/**
 * The tickers the caller is allowed to see price history for: the ones they
 * track personally, and the ones tracked by any group they belong to.
 *
 * Price rows themselves carry no owner — they are market data keyed by ticker,
 * shared by every user tracking that instrument — so the tracked-ticker list is
 * what scopes reads and deletes to a tenant.
 *
 * Personal tickers count even when the caller is in a group. `userGroups` is
 * every group the caller belongs to, not the one they are working in, so
 * reading it as "group context" hid a personal portfolio from anyone who had
 * joined a group at all.
 */
async function accessibleTickers(userId: string, userGroups: string[]): Promise<string[]> {
  const personal = { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };
  const scope = userGroups.length === 0 ? personal : { $or: [personal, { groupId: { $in: userGroups } }] };

  return TrackedTicker.distinct('ticker', scope);
}

/**
 * Get price history for the caller's tracked tickers.
 *
 * Filtering, sorting and the row cap all run in Mongo: the collection grows by
 * (tracked tickers × trading days) forever, so returning it unfiltered — as
 * this once did — loads an unbounded result set into the service on every call.
 */
export async function getTickerPriceHistory(
  userId: string,
  userGroups: string[] = [],
  query: PriceHistoryQuery = {}
): Promise<TickerPriceResponse[]> {
  const allowed = await accessibleTickers(userId, userGroups);
  if (allowed.length === 0) return [];

  const tickers = query.ticker
    ? allowed.filter((t) => t === query.ticker)
    : allowed;
  if (tickers.length === 0) return [];

  // The retention floor wins over a wider `from`: the plan decides how far back
  // reads may reach, and a client asking for two years cannot opt out of it by
  // asking. This is the whole planner gate — the frontier's covariance estimate
  // is meaningless on ninety days of closes, and unlike a client-side
  // `<PaywallGate>` there is nothing here to bypass from devtools, because the
  // rows are simply not returned.
  const lowerBound = [query.from, query.retentionFrom ?? undefined]
    .filter((d): d is Date => d instanceof Date)
    .reduce<Date | undefined>((latest, d) => (!latest || d > latest ? d : latest), undefined);

  // `$in: [..., null]` rather than a bare equality: rows written before the
  // field existed carry no `interval` at all, and matching on 'daily' alone
  // would return nothing for every chart in the product. Unlike `$ne`, this
  // still uses the { ticker, interval, date } index.
  const interval = query.interval ?? 'daily';
  const filter: Record<string, unknown> = {
    ticker: { $in: tickers },
    interval: interval === 'daily' ? { $in: ['daily', null] } : interval
  };
  if (lowerBound || query.to) {
    filter.date = {
      ...(lowerBound ? { $gte: lowerBound } : {}),
      ...(query.to ? { $lte: query.to } : {})
    };
  }

  const limit = Math.min(query.limit ?? DEFAULT_PRICE_HISTORY_LIMIT, MAX_PRICE_HISTORY_LIMIT);

  // Ticker ASC then date DESC is served directly by the { ticker: 1, date: 1 }
  // index, so no in-memory re-sort is needed.
  const records = await TickerPriceHistory.find(filter)
    .sort({ ticker: 1, date: -1 })
    .limit(limit)
    .lean();

  return records.map((r) => ({
    _id: r._id?.toString(),
    date: r.date.toISOString(),
    ticker: r.ticker,
    price: r.price,
    open: r.open,
    high: r.high,
    low: r.low,
    volume: r.volume
  }));
}

export interface IntervalCoverage {
  /** Rows stored for this interval. */
  count: number;
  /** Oldest and newest close held, ISO dates. `null` when nothing is stored. */
  first: string | null;
  last: string | null;
  /**
   * When a fetch last wrote any row of this series — a real instant, unlike
   * `last`, which is a session date at midnight UTC.
   *
   * These answer different questions and were previously confused for each
   * other: over a weekend `last` stops moving while `fetchedAt` keeps updating
   * nightly, which is exactly how a working job is told from a stalled one.
   * `null` for rows written before the collection carried timestamps.
   */
  fetchedAt: string | null;
}

export interface TickerCoverage {
  ticker: string;
  daily: IntervalCoverage;
  weekly: IntervalCoverage;
}

const EMPTY_COVERAGE: IntervalCoverage = { count: 0, first: null, last: null, fetchedAt: null };

/**
 * How much price history exists per tracked ticker, and how fresh it is.
 *
 * The sync UI is otherwise guessing: a user looking at a chart cannot tell
 * whether a short series means the instrument is new, the daily job stopped, or
 * nobody ever fetched history — and those need three different actions. One
 * aggregation over the collection answers all three, and it is grouped rather
 * than fetched because the collection is unbounded.
 *
 * Scoped to the caller's tracked tickers exactly like the reads: price rows
 * carry no owner of their own.
 */
export async function getTickerCoverage(
  userId: string,
  userGroups: string[] = []
): Promise<TickerCoverage[]> {
  const allowed = await accessibleTickers(userId, userGroups);
  if (allowed.length === 0) return [];

  const rows = await TickerPriceHistory.aggregate<{
    _id: { ticker: string; interval: string | null };
    count: number;
    first: Date;
    last: Date;
    fetchedAt: Date | null;
  }>([
    { $match: { ticker: { $in: allowed } } },
    {
      $group: {
        // Rows written before the field existed are daily by definition; see
        // the note on the read filter.
        _id: { ticker: '$ticker', interval: { $ifNull: ['$interval', 'daily'] } },
        count: { $sum: 1 },
        first: { $min: '$date' },
        last: { $max: '$date' },
        // The newest write across the series, not of the newest bar: a run that
        // re-reads a hundred unchanged sessions still proves the job is alive.
        fetchedAt: { $max: '$updatedAt' }
      }
    }
  ]);

  const byTicker = new Map<string, TickerCoverage>(
    allowed.map((ticker) => [
      ticker,
      { ticker, daily: { ...EMPTY_COVERAGE }, weekly: { ...EMPTY_COVERAGE } }
    ])
  );

  for (const row of rows) {
    const entry = byTicker.get(row._id.ticker);
    if (!entry) continue;
    const interval = row._id.interval === 'weekly' ? 'weekly' : 'daily';
    entry[interval] = {
      count: row.count,
      first: row.first ? row.first.toISOString() : null,
      last: row.last ? row.last.toISOString() : null,
      fetchedAt: row.fetchedAt ? row.fetchedAt.toISOString() : null
    };
  }

  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/**
 * Fetch and save the latest price for a ticker the caller tracks.
 */
export async function fetchAndSaveTickerPrices(
  tickerParam: string,
  userId: string,
  userGroups: string[] = []
): Promise<TickerPriceResponse[]> {
  await assertTracked(tickerParam, userId, userGroups);

  const results: TickerPriceResponse[] = [];
  const priceData = await fetchStockPrice(tickerParam);

  if (priceData) {
    const today = toUtcDateOnly(new Date());
    const record = await TickerPriceHistory.findOneAndUpdate(
      { ticker: tickerParam, interval: 'daily', date: today },
      {
        ticker: tickerParam,
        interval: 'daily',
        date: today,
        price: priceData.close,
        open: priceData.open,
        high: priceData.high,
        low: priceData.low,
        volume: priceData.volume
      },
      { upsert: true, new: true }
    );

    results.push({
      date: record.date.toISOString(),
      ticker: record.ticker,
      price: record.price,
      open: record.open,
      high: record.high,
      low: record.low,
      volume: record.volume
    });
  }

  return results;
}

/** Reject a ticker the caller does not track, so quota can only be spent on own instruments. */
async function assertTracked(ticker: string, userId: string, userGroups: string[]): Promise<void> {
  const allowed = await accessibleTickers(userId, userGroups);
  if (!allowed.includes(ticker)) {
    throw new ForbiddenError('Ticker is not tracked in this context');
  }
}

/**
 * Fetch and save all historic prices for a ticker the caller tracks
 */
export async function fetchAllTickerHistory(
  ticker: string,
  userId: string,
  userGroups: string[] = []
): Promise<number> {
  if (!ticker) {
    throw new BadRequestError('Ticker is required');
  }
  await assertTracked(ticker, userId, userGroups);
  return fetchAndSaveAllStockHistory(ticker);
}

/**
 * Fetch a ticker's whole weekly series — usually 10–20 years — for one API call.
 *
 * The same price as the ~100-day daily fetch, and the only way to get real
 * depth from the free tier, so this is what a newly tracked instrument should
 * be seeded with. Stored as its own interval; nothing reads the two together.
 */
export async function fetchWeeklyTickerHistory(
  ticker: string,
  userId: string,
  userGroups: string[] = []
): Promise<number> {
  if (!ticker) {
    throw new BadRequestError('Ticker is required');
  }
  await assertTracked(ticker, userId, userGroups);
  return fetchAndSaveWeeklyHistory(ticker);
}

/**
 * Delete a price history record, provided the caller tracks its ticker.
 */
export async function deleteTickerPriceRecord(
  id: string,
  userId: string,
  userGroups: string[] = []
): Promise<string> {
  if (!id) {
    throw new BadRequestError('ID is required');
  }

  const record = await TickerPriceHistory.findById(id);
  if (!record) {
    return id;
  }

  await assertTracked(record.ticker, userId, userGroups);

  await TickerPriceHistory.findByIdAndDelete(id);
  return id;
}
