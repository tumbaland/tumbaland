import { financeApi } from './financeApi';
import { ApiResponse } from '../types';

export interface TickerPriceHistory {
  _id?: string;
  ticker: string;
  date: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

/**
 * Which series to read. Daily is the default everywhere; weekly exists because
 * it is the only free way to get more than ~100 trading days out of the
 * provider. The two are never mixed — a weekly return annualized as a daily one
 * overstates the figure roughly fivefold.
 */
export type PriceInterval = 'daily' | 'weekly';

export interface PriceHistoryQuery {
  ticker?: string;
  /** Inclusive YYYY-MM-DD bounds. */
  from?: string;
  to?: string;
  limit?: number;
  interval?: PriceInterval;
}

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  date: string;
}

const API_URL = '/ticker-price-history';

/**
 * Price history for the caller's tracked tickers. Always narrow with a ticker
 * or a date range where possible: the collection grows by (tickers × trading
 * days) forever, and the server caps what one call can return.
 */
export const getTickerPriceHistory = async (
  query: PriceHistoryQuery = {}
): Promise<TickerPriceHistory[]> => {
  const params: Record<string, string> = {};
  if (query.ticker) params.ticker = query.ticker;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.limit !== undefined) params.limit = String(query.limit);
  if (query.interval) params.interval = query.interval;

  const res = await financeApi.get<ApiResponse<TickerPriceHistory[]>>(API_URL, { params });
  return res.data;
};

export interface IntervalCoverage {
  count: number;
  /** ISO timestamps, or null when nothing is stored for that interval. */
  first: string | null;
  last: string | null;
  /**
   * When a fetch last wrote this series — a real instant, unlike `last`, which
   * is a session date at midnight UTC. Null for rows predating timestamps.
   */
  fetchedAt: string | null;
}

export interface TickerCoverage {
  ticker: string;
  daily: IntervalCoverage;
  weekly: IntervalCoverage;
}

/**
 * How much price history each tracked ticker holds and how fresh it is.
 *
 * Without this the sync UI cannot tell "this instrument is new" from "the daily
 * job stopped" from "nobody ever fetched history" — three states that look
 * identical on a short chart and need three different actions.
 */
export const getTickerCoverage = async (): Promise<TickerCoverage[]> => {
  const res = await financeApi.get<ApiResponse<TickerCoverage[]>>(`${API_URL}/coverage`);
  return res.data;
};

/** Remaining Alpha Vantage calls for today, shared across the deployment. */
export const getQuota = async (): Promise<QuotaStatus> => {
  const res = await financeApi.get<ApiResponse<QuotaStatus>>(`${API_URL}/quota`);
  return res.data;
};

export const fetchTickerPriceHistory = async (ticker: string): Promise<void> => {
  await financeApi.post('/ticker-price-history/fetch', { ticker });
};

export const deleteTickerPriceHistory = async (id: string): Promise<void> => {
  await financeApi.delete(`/ticker-price-history/${id}`);
};

export const fetchAllTickerPriceHistory = async (ticker: string): Promise<void> => {
  await financeApi.post('/ticker-price-history/fetch-all', { ticker });
};

export interface WeeklyFetchResult {
  ticker: string;
  recordsCount: number;
}

/**
 * Pull the instrument's entire weekly history — usually 10–20 years — for one
 * provider call, the same price as the ~100-day daily fetch.
 */
export const fetchWeeklyTickerPriceHistory = async (ticker: string): Promise<WeeklyFetchResult> => {
  const res = await financeApi.post<ApiResponse<WeeklyFetchResult>>('/ticker-price-history/fetch-weekly', { ticker });
  return res.data;
};
