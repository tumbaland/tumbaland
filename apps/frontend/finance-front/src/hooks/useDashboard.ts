import { useQuery } from '@tanstack/react-query';
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
  }>;
  assetAllocation: Array<{
    assetClass: string;
    percentage: number;
    value: number;
    color?: string;
  }>;
}

export const useDashboard = (groupId?: string) => {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', groupId],
    queryFn: async () => {
      const params = groupId ? { groupId } : {};
      const response = await financeApi.get('/dashboard', { params });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
};