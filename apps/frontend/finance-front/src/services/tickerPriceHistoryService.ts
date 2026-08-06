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

export interface PriceHistoryQuery {
  ticker?: string;
  /** Inclusive YYYY-MM-DD bounds. */
  from?: string;
  to?: string;
  limit?: number;
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

  const res = await financeApi.get<ApiResponse<TickerPriceHistory[]>>(API_URL, { params });
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
