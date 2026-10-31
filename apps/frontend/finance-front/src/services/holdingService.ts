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
  // Derived from the trade log (zero for holdings entered by hand)
  realizedGain?: number;
  dividends?: number;
  tradeFees?: number;
  tradeCount?: number;
  currentValue?: number;
  valueIncrease?: number;
  percentIncrease?: number;
}

/** A position bought and later sold out entirely; money fields are in `baseCurrency`. */
export interface ClosedPosition {
  ticker: string;
  displayName?: string;
  currency: string;
  baseCurrency: string;
  firstTradeDate: string;
  closedDate: string;
  bought?: number;
  proceeds?: number;
  realizedGain?: number;
  dividends?: number;
  totalReturn?: number;
  fees?: number;
  tradeCount: number;
  /** True when no FX rate was available, so the money fields are omitted. */
  missingFxRate: boolean;
}

const API_URL = '/holdings';

export const getClosedPositions = async (groupId?: string): Promise<ClosedPosition[]> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<ClosedPosition[]>>(`${API_URL}/closed`, { params });
  return res.data;
};

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
