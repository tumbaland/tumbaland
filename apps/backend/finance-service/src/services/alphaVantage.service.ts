import { logger, TooManyRequestsError } from '@tumbaland/backend-core';
import TickerPriceHistory, { PriceInterval } from '../models/TickerPriceHistory';
import { consumeQuota, releaseQuota } from './apiQuota.service';

const BASE_URL = 'https://www.alphavantage.co/query';

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error('Alpha Vantage API key not set in environment variables');
  return key;
}

// Alpha Vantage returns HTTP 200 with a Note/Information field when throttled
function isThrottled(data: Record<string, unknown>): boolean {
  return !!(data['Note'] || data['Information']);
}

function getThrottleMessage(data: Record<string, unknown>): string {
  const notice = data['Note'] || data['Information'];
  return typeof notice === 'string' ? notice : 'Rate limit hit';
}

/**
 * Every call to the provider goes through here so exactly one place reserves
 * daily quota. The reservation happens *before* the request: releasing it again
 * only when `fetch` itself throws, because anything that came back with a
 * response — including a throttle notice — was already counted by the provider.
 */
async function request(url: string): Promise<Record<string, unknown>> {
  await consumeQuota();

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    await releaseQuota();
    throw err;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export interface StockPriceData {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  date: string; // YYYY-MM-DD (actual trading day from API)
}

export interface TickerSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: string;
}

// Fetch the latest quote for a symbol using GLOBAL_QUOTE (1 call, returns OHLCV + trading date).
// More efficient than TIME_SERIES_DAILY which downloads 100 days just to read the first row.
export async function fetchStockPrice(symbol: string): Promise<StockPriceData | null> {
  const data = await request(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${getApiKey()}`);

  if (isThrottled(data)) {
    logger.warn('Alpha Vantage rate limit hit', { symbol, message: getThrottleMessage(data) });
    return null;
  }

  const quote = data['Global Quote'] as Record<string, string> | undefined;
  if (!quote || !quote['05. price']) return null;

  return {
    close: parseFloat(quote['05. price']),
    open: parseFloat(quote['02. open']),
    high: parseFloat(quote['03. high']),
    low: parseFloat(quote['04. low']),
    volume: parseFloat(quote['06. volume']),
    date: quote['07. latest trading day']
  };
}

/**
 * Writes one provider time series into the price history.
 *
 * Shared by the daily and weekly fetches because the two responses differ only
 * in which key holds the series and which interval the rows belong to — and a
 * second copy of this loop is how the two series start disagreeing about date
 * normalization.
 */
async function saveTimeSeries(
  symbol: string,
  timeSeries: Record<string, Record<string, string>>,
  interval: PriceInterval
): Promise<number> {
  const operations = Object.entries(timeSeries).map(([date, entry]) => ({
    updateOne: {
      filter: { ticker: symbol, interval, date: new Date(date) },
      update: {
        $set: {
          ticker: symbol,
          interval,
          date: new Date(date),
          price: parseFloat(entry['4. close']),
          open: parseFloat(entry['1. open']),
          high: parseFloat(entry['2. high']),
          low: parseFloat(entry['3. low']),
          volume: parseFloat(entry['5. volume'])
        }
      },
      upsert: true
    }
  }));
  if (operations.length === 0) return 0;

  // One round trip for the series, not one per day: a weekly backfill is a
  // decade or two of rows.
  await TickerPriceHistory.bulkWrite(operations, { ordered: false });
  return operations.length;
}

// Fetch historic OHLCV prices for a symbol and save to DB.
// Returns last ~100 trading days (compact). outputsize=full requires a premium plan.
export async function fetchAndSaveAllStockHistory(symbol: string): Promise<number> {
  const data = await request(`${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${getApiKey()}`);

  if (isThrottled(data)) {
    throw new TooManyRequestsError(`Alpha Vantage rate limit: ${getThrottleMessage(data)}`);
  }

  const timeSeries = data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) return 0;

  return saveTimeSeries(symbol, timeSeries, 'daily');
}

/**
 * Fetch the *entire* weekly series for a symbol — typically 10–20 years — and
 * save it as the weekly interval.
 *
 * This is the only way to get real depth out of the free tier. `TIME_SERIES_DAILY`
 * is capped at the compact ~100 trading days, and asking it for `outputsize=full`
 * returns no data at all, only: "The outputsize=full parameter value is a premium
 * feature for the TIME_SERIES_DAILY endpoint." `TIME_SERIES_WEEKLY` takes no
 * `outputsize` parameter and returns everything by default, on the same free key.
 *
 * Costs one call, exactly like the daily fetch, so a symbol tracked today can
 * have a decade of covariance history for the same price as a hundred days.
 */
export async function fetchAndSaveWeeklyHistory(symbol: string): Promise<number> {
  const data = await request(`${BASE_URL}?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${getApiKey()}`);

  if (isThrottled(data)) {
    throw new TooManyRequestsError(`Alpha Vantage rate limit: ${getThrottleMessage(data)}`);
  }

  const timeSeries = data['Weekly Time Series'] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) return 0;

  return saveTimeSeries(symbol, timeSeries, 'weekly');
}

// Search for ticker symbols by keyword using Alpha Vantage SYMBOL_SEARCH.
// Costs 1 API call. Free plan: 25 calls/day total.
export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  const data = await request(
    `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${getApiKey()}`
  );

  if (isThrottled(data)) {
    throw new TooManyRequestsError(`Alpha Vantage rate limit: ${getThrottleMessage(data)}`);
  }

  const matches = (data['bestMatches'] || []) as Record<string, string>[];
  return matches.map((m) => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: m['3. type'],
    region: m['4. region'],
    currency: m['8. currency'],
    matchScore: m['9. matchScore']
  }));
}

/**
 * Current exchange rate for a currency pair (1 unit of `from` in `to`).
 * Costs 1 API call.
 */
export async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  const data = await request(
    `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${getApiKey()}`
  );

  if (isThrottled(data)) {
    logger.warn('Alpha Vantage rate limit hit', { from, to, message: getThrottleMessage(data) });
    return null;
  }

  const quote = data['Realtime Currency Exchange Rate'] as Record<string, string> | undefined;
  const rate = quote?.['5. Exchange Rate'];
  if (!rate) return null;

  const parsed = parseFloat(rate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
