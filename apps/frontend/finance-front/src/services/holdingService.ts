import { financeApi } from './financeApi';
import { ApiResponse } from '../types';

export interface Holding {
  _id?: string;
  ticker: string;
  displayName?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
  groupId?: string;
  // Enriched by the backend from tracked ticker price history.
  // Per-share figures (avgBuyPrice, latestPrice, athPrice) are in `currency`;
  // the totals (costBasis, currentValue, valueIncrease) are in `baseCurrency`.
  currency?: string;
  baseCurrency?: string;
  fxRate?: number;
  /** True when no FX rate was available, so totals are omitted. */
  missingFxRate?: boolean;
  latestPrice?: number;
  latestPriceDate?: string;
  athPrice?: number;
  costBasis?: number;
  currentValue?: number;
  valueIncrease?: number;
  percentIncrease?: number;
}

const API_URL = '/holdings';

export const getHoldings = async (groupId?: string): Promise<Holding[]> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<Holding[]>>(API_URL, { params });
  return res.data;
};

export const addHolding = async (data: Omit<Holding, '_id'>): Promise<Holding> => {
  const res = await financeApi.post<ApiResponse<Holding>>(API_URL, data);
  return res.data;
};

export const updateHolding = async (id: string, data: Partial<Holding>): Promise<Holding> => {
  const res = await financeApi.put<ApiResponse<Holding>>(`${API_URL}/${id}`, data);
  return res.data;
};

export const deleteHolding = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};
