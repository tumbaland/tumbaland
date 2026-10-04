import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/holdingService', () => ({
  getHoldings: vi.fn(),
  addHolding: vi.fn(),
  updateHolding: vi.fn(),
  deleteHolding: vi.fn()
}));

import * as holdingService from '../services/holdingService';
import { useHoldings, useCreateHolding, useUpdateHolding, useDeleteHolding } from './useHoldings';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient
  };
}

beforeEach(() => vi.clearAllMocks());

it('fetches holdings scoped to a group', async () => {
  (holdingService.getHoldings as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: 'h1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useHoldings('group-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(holdingService.getHoldings).toHaveBeenCalledWith('group-1');
});

it('creates a holding and invalidates holdings/trackedTickers/dashboard', async () => {
  (holdingService.addHolding as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'h2' });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateHolding(), { wrapper: Wrapper });
  result.current.mutate({ ticker: 'AAPL', quantity: 1, avgBuyPrice: 100 });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['holdings'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trackedTickers'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
});

it('updates a holding', async () => {
  (holdingService.updateHolding as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'h1', quantity: 5 });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateHolding(), { wrapper: Wrapper });
  result.current.mutate({ id: 'h1', data: { quantity: 5 } });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(holdingService.updateHolding).toHaveBeenCalledWith('h1', { quantity: 5 });
});

it('deletes a holding', async () => {
  (holdingService.deleteHolding as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useDeleteHolding(), { wrapper: Wrapper });
  result.current.mutate('h1');

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(holdingService.deleteHolding).toHaveBeenCalledWith('h1', expect.anything());
});
