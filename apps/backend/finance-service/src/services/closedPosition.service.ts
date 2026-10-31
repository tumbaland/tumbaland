import Holding from '../models/Holding';
import Trade from '../models/Trade';
import TrackedTicker from '../models/TrackedTicker';
import { tenantScope } from '../utils/scope';
import { BASE_CURRENCY, getRates } from './fxRate.service';
import { derivePosition } from './position.service';

/**
 * A position that was bought and later sold out entirely.
 *
 * Selling the last unit deletes the holding, which is right for the portfolio
 * but takes everything that position earned with it: the gain it realised and
 * the dividends it paid. This keeps that history readable. Money figures are in
 * the base currency; a position whose currency has no rate yet comes back
 * without them rather than with a foreign amount passed off as base.
 */
export interface ClosedPosition {
  ticker: string;
  displayName?: string;
  currency: string;
  baseCurrency: string;
  /** First purchase and last sale, as ISO dates. */
  firstTradeDate: string;
  closedDate: string;
  /** Everything paid in buying, fees included. */
  bought?: number;
  /** Everything received in selling, fees taken off. */
  proceeds?: number;
  realizedGain?: number;
  dividends?: number;
  /** Realised gain plus dividends: what the position made in all. */
  totalReturn?: number;
  fees?: number;
  tradeCount: number;
  missingFxRate: boolean;
}

/** Below this a position counts as closed; float drift can leave a whisker. */
const EPSILON = 1e-9;

export const getClosedPositions = async (
  userId: string,
  userGroups: string[] = []
): Promise<ClosedPosition[]> => {
  const scope = tenantScope(userId, userGroups);
  const [trades, holdings] = await Promise.all([
    Trade.find(scope).sort({ date: 1 }).lean(),
    Holding.find(scope, { ticker: 1 }).lean()
  ]);

  const open = new Set(holdings.map((h) => String(h.ticker).toUpperCase()));
  const byTicker = new Map<string, typeof trades>();
  for (const trade of trades) {
    const key = String(trade.ticker).toUpperCase();
    byTicker.set(key, [...(byTicker.get(key) || []), trade]);
  }

  const closed = [...byTicker.entries()].filter(([ticker, list]) => {
    if (open.has(ticker)) return false;
    // Only a position that was actually held and then sold out: dividends alone
    // are not a closed position, and an unsold one belongs among the holdings.
    return list.some((t) => t.type === 'buy') && derivePosition(list as never).quantity <= EPSILON;
  });
  if (closed.length === 0) return [];

  const tickers = closed.map(([ticker]) => ticker);
  const tracked = await TrackedTicker.find({ ...scope, ticker: { $in: tickers } }).lean();
  const nameOf = new Map(tracked.map((t) => [String(t.ticker).toUpperCase(), t.displayName]));
  const currencyOf = new Map(
    tracked.filter((t) => t.currency).map((t) => [String(t.ticker).toUpperCase(), t.currency as string])
  );
  const rates = await getRates([...currencyOf.values()], BASE_CURRENCY);

  return closed
    .map(([ticker, list]): ClosedPosition => {
      const position = derivePosition(list as never);
      const currency = currencyOf.get(ticker) || BASE_CURRENCY;
      const fx = currency === BASE_CURRENCY ? 1 : rates.get(currency);
      const convert = (value: number) => (fx === undefined ? undefined : value * fx);

      const buys = list.filter((t) => t.type === 'buy');
      const sells = list.filter((t) => t.type === 'sell');
      const bought = buys.reduce((sum, t) => sum + t.quantity * t.price + (t.fees || 0), 0);
      const proceeds = sells.reduce((sum, t) => sum + t.quantity * t.price - (t.fees || 0), 0);
      const dates = list.map((t) => new Date(t.date).getTime());
      const lastSell = sells.length ? Math.max(...sells.map((t) => new Date(t.date).getTime())) : Math.max(...dates);

      return {
        ticker,
        displayName: nameOf.get(ticker),
        currency,
        baseCurrency: BASE_CURRENCY,
        firstTradeDate: new Date(Math.min(...dates)).toISOString().slice(0, 10),
        closedDate: new Date(lastSell).toISOString().slice(0, 10),
        bought: convert(bought),
        proceeds: convert(proceeds),
        realizedGain: convert(position.realizedGain),
        dividends: convert(position.dividends),
        totalReturn: convert(position.realizedGain + position.dividends),
        fees: convert(position.fees),
        tradeCount: position.tradeCount,
        missingFxRate: fx === undefined
      };
    })
    .sort((a, b) => b.closedDate.localeCompare(a.closedDate));
};
