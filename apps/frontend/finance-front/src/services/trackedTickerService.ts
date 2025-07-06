import { financeApi } from '../config/financeApi';

export interface TrackedTicker {
  _id?: string;
  ticker: string;
  displayName: string;
  description?: string;
  dateAdded?: string;
  isActive: boolean;
}

const API_URL = '/tracked-tickers';

export const getTrackedTickers = async (): Promise<TrackedTicker[]> => {
  const res = await financeApi.get(API_URL);
  return res.data;
};

export const addTrackedTicker = async (data: Omit<TrackedTicker, '_id' | 'dateAdded'>): Promise<TrackedTicker> => {
  const res = await financeApi.post(API_URL, data);
  return res.data;
};

export const updateTrackedTicker = async (id: string, data: Partial<TrackedTicker>): Promise<TrackedTicker> => {
  const res = await financeApi.put(`${API_URL}/${id}`, data);
  return res.data;
};

export const deleteTrackedTicker = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};
