import { financeApi } from '../config/financeApi';
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

const API_URL = '/ticker-price-history';

export const getTickerPriceHistory = async (ticker?: string): Promise<TickerPriceHistory[]> => {
  const url = ticker ? `${API_URL}?ticker=${ticker}` : API_URL;
  const res = await financeApi.get<ApiResponse<TickerPriceHistory[]>>(url);
  return res.data.data;
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
