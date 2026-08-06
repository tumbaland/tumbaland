import { financeApi } from './financeApi';
import { ApiResponse } from '../types';

export interface DashboardKPIs {
  netWorth: number;
  assets: number;
  liabilities: number;
  asOf: string | null;
  /** Null when there is no check-in exactly one month / one year back. */
  monthChange: number | null;
  monthChangePct: number | null;
  yearChange: number | null;
  yearChangePct: number | null;
  totalGain: number;
  totalGainPct: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  netWorthHistory: Array<{
    date: string;
    total: number;
    assets: number;
    liabilities: number;
    byClass: Record<string, number>;
  }>;
  allocation: Array<{
    assetClassId: string;
    name: string;
    color: string;
    value: number;
    gain: number;
    percentage: number;
  }>;
  liabilities: Array<{
    assetClassId: string;
    name: string;
    color: string;
    value: number;
  }>;
  assetColors: Record<string, string>;
  /** Base currency every total on this payload is expressed in. */
  currency: string;
  /**
   * Why net worth moved, not just that it did. Null until there are
   * transactions to explain it with.
   */
  cashflow: {
    latestMonth: {
      month: string;
      income: number;
      expense: number;
      savings: number;
      savingsRate: number | null;
    } | null;
    averageSavingsRate: number | null;
    growth: {
      from: string;
      to: string;
      netWorthChange: number;
      contributions: number;
      marketGrowth: number;
      complete: boolean;
    } | null;
  } | null;
  holdings: {
    count: number;
    totalValue: number;
    totalCost: number;
    gain: number;
    gainPct: number;
    /** Holdings excluded from the totals for want of an FX rate. */
    unconverted: number;
  } | null;
}

const API_URL = '/dashboard';

export const getDashboard = async (groupId?: string): Promise<DashboardData> => {
  const params = groupId ? { groupId } : {};
  const res = await financeApi.get<ApiResponse<DashboardData>>(API_URL, { params });
  return res.data;
};
