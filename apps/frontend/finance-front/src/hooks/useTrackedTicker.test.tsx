import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/trackedTickerService', () => ({
  getTrackedTickers: vi.fn(),
  addTrackedTicker: vi.fn(),
  updateTrackedTicker: vi.fn(),
  deleteTrackedTicker: vi.fn()
}));

import * as trackedTickerService from '../services/trackedTickerService';
import {
  useTrackedTickers,
  useCreateTrackedTicker,
  useUpdateTrackedTicker,
  useDeleteTrackedTicker
} from './useTrackedTicker';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { Wrapper: ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ), queryClient };
}

beforeEach(() => vi.clearAllMocks());

it('fetches tracked tickers scoped to a group', async () => {
  (trackedTickerService.getTrackedTickers as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: 't1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useTrackedTickers('group-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(trackedTickerService.getTrackedTickers).toHaveBeenCalledWith('group-1');
});

it('creates a tracked ticker and invalidates trackedTickers', async () => {
  (trackedTickerService.addTrackedTicker as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 't2' });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateTrackedTicker(), { wrapper: Wrapper });
  result.current.mutate({ ticker: 'AAPL', displayName: 'Apple', isActive: true });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trackedTickers'] });
});

it('updates a tracked ticker', async () => {
  (trackedTickerService.updateTrackedTicker as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 't1', isActive: false });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateTrackedTicker(), { wrapper: Wrapper });
  result.current.mutate({ id: 't1', data: { isActive: false } });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(trackedTickerService.updateTrackedTicker).toHaveBeenCalledWith('t1', { isActive: false });
});

it('deletes a tracked ticker', async () => {
  (trackedTickerService.deleteTrackedTicker as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useDeleteTrackedTicker(), { wrapper: Wrapper });
  result.current.mutate('t1');

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(trackedTickerService.deleteTrackedTicker).toHaveBeenCalledWith('t1', expect.anything());
});
