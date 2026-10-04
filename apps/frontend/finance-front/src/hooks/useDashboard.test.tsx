import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/dashboardService', () => ({
  getDashboard: vi.fn()
}));

import * as dashboardService from '../services/dashboardService';
import { useDashboard } from './useDashboard';

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

it('fetches dashboard data scoped to a group', async () => {
  (dashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({ kpis: { netWorth: 100 } });

  const { result } = renderHook(() => useDashboard('group-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(dashboardService.getDashboard).toHaveBeenCalledWith('group-1');
  expect(result.current.data).toEqual({ kpis: { netWorth: 100 } });
});
