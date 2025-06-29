import { apiClient } from '../api/config';

export interface TickerPriceHistory {
  _id?: string;
  ticker: string;
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

const API_URL = '/ticker-price-history';

export const getTickerPriceHistory = async (ticker?: string): Promise<TickerPriceHistory[]> => {
  const url = ticker ? `${API_URL}?ticker=${ticker}` : API_URL;
  const res = await apiClient.get(url);
  return res.data;
};

export const fetchTickerPriceHistory = async (ticker: string): Promise<void> => {
  await apiClient.post('/ticker-price-history/fetch', { ticker });
};

export const deleteTickerPriceHistory = async (id: string): Promise<void> => {
  await apiClient.delete(`/ticker-price-history/${id}`);
};

// No add, update, or delete methods since this is read-only and fetched from Yahoo Finance
