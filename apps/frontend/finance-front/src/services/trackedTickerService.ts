import { financeApi } from '../config/financeApi';

export interface TrackedTicker {
  _id?: string;
  ticker: string;
  displayName: string;
  description?: string;
  dateAdded?: string;
  isActive: boolean;
  groupId?: string;
}

const API_URL = '/tracked-tickers';

export const getTrackedTickers = async (groupId?: string): Promise<TrackedTicker[]> => {
  const params = new URLSearchParams();
  if (groupId) {
    params.append('groupId', groupId);
  }
  const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
  const res = await financeApi.get(url);
  return res.data.data;
};

export const addTrackedTicker = async (data: Omit<TrackedTicker, '_id' | 'dateAdded'>): Promise<TrackedTicker> => {
  const res = await financeApi.post(API_URL, data);
  return res.data.data;
};

export const updateTrackedTicker = async (id: string, data: Partial<TrackedTicker>): Promise<TrackedTicker> => {
  const res = await financeApi.put(`${API_URL}/${id}`, data);
  return res.data.data;
};

export const deleteTrackedTicker = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};

export interface TickerSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: string;
}

export const searchTickers = async (query: string): Promise<TickerSearchResult[]> => {
  const res = await financeApi.get(`${API_URL}/search?q=${encodeURIComponent(query)}`);
  return res.data.data;
};
