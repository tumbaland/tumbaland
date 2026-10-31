import { financeApi } from './financeApi';
import { ApiResponse } from '../types';
import { PeriodTotals } from './cashflowService';

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
    /** How reachable it is; absent on classes not yet sorted. */
    liquidity?: 'cash' | 'market' | 'locked';
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
    /**
     * The trailing twelve months rather than the current one: the newest month
     * is usually only part-imported, so a card keyed to it reports a collapse
     * in income that never happened.
     */
    trailing: PeriodTotals;
    previous: PeriodTotals | null;
    /** Carried only when the period is fully covered by transactions. */
    growth: {
      from: string;
      to: string;
      netWorthChange: number;
      contributions: number;
      marketGrowth: number;
      complete: boolean;
    } | null;
  } | null;
  /**
   * Can the money be reached, and for how long would it last. Null until there
   * is a check-in. Runway is in months of what was consumed over the trailing
   * year, so buying funds is not counted as spending, and is before any tax a
   * sale would cost.
   */
  safety: {
    cash: number;
    market: number;
    locked: number;
    /** Assets in classes not yet marked cash, sellable or locked. */
    unsorted: number;
    monthlySpending: number | null;
    cashMonths: number | null;
    reachableMonths: number | null;
  } | null;
  holdings: {
    count: number;
    totalValue: number;
    totalCost: number;
    gain: number;
    gainPct: number;
    /** Received, from positions held and from ones since sold. */
    dividends: number;
    /** Gains crystallised by selling, held and sold positions together. */
    realizedGain: number;
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
