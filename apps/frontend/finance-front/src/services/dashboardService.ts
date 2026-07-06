import { financeApi } from '../config/financeApi';
import { ApiResponse } from '../types';

export interface DashboardKPIs {
  netWorth: number;
  asOf: string | null;
  monthChange: number;
  monthChangePct: number;
  yearChange: number;
  yearChangePct: number;
  totalGain: number;
  totalGainPct: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  netWorthHistory: Array<{
    date: string;
    total: number;
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
  assetColors: Record<string, string>;
  holdings: {
    count: number;
    totalValue: number;
    totalCost: number;
    gain: number;
    gainPct: number;
  } | null;
}

const API_URL = '/dashboard';

export const getDashboard = async (groupId?: string): Promise<DashboardData> => {
  const params = groupId ? { groupId } : {};
  const res = await financeApi.get<ApiResponse<DashboardData>>(API_URL, { params });
  return res.data;
};
