import { financeApi } from '../config/financeApi';

export interface DashboardKPIs {
  totalPortfolioValue: number;
  totalInvested: number;
  totalGains: number;
  totalGainsPercentage: number;
  monthlyChange: number;
  monthlyChangePercentage: number;
  assetBreakdown: {
    stocks: number;
    etfs: number;
    cash: number;
    other: number;
  };
  topPerformers: Array<{
    symbol: string;
    currentValue: number;
    percentIncrease: number;
  }>;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  portfolioHistory: Array<{
    date: string;
    totalValue: number;
    totalInvested: number;
    assetBreakdown: {
      [assetClass: string]: number;
    };
  }>;
  assetAllocation: Array<{
    assetClass: string;
    percentage: number;
    value: number;
    color?: string;
  }>;
}

const API_URL = '/dashboard';

export const getDashboard = async (groupId?: string): Promise<DashboardData> => {
  const params = groupId ? { groupId } : {};
  const res = await financeApi.get(API_URL, { params });
  return res.data;
};