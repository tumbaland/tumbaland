import TickerPriceHistory from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';
import { fetchStockPrice, fetchAndSaveAllStockHistory } from './alphaVantage.service';
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
 * track personally, or the ones tracked by the group they are working in.
 *
 * Price rows themselves carry no owner — they are market data keyed by ticker,
 * shared by every user tracking that instrument — so the tracked-ticker list is
 * what scopes reads and deletes to a tenant.
 */
async function accessibleTickers(userId: string, userGroups: string[]): Promise<string[]> {
  const scope =
    userGroups.length === 0
      ? { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] }
      : { groupId: { $in: userGroups } };

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

  const filter: Record<string, unknown> = { ticker: { $in: tickers } };
  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: query.from } : {}),
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
      { ticker: tickerParam, date: today },
      {
        ticker: tickerParam,
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
