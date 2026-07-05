import { useQuery } from '@tanstack/react-query';
import { getDashboard, DashboardData } from '../services/dashboardService';

export type { DashboardData, DashboardKPIs } from '../services/dashboardService';

export const useDashboard = (groupId?: string) => {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', groupId],
    queryFn: () => getDashboard(groupId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
};
