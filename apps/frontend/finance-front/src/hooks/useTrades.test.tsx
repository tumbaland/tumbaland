import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/tradeService', () => ({
  getTrades: vi.fn(),
  getPosition: vi.fn(),
  addTrade: vi.fn(),
  updateTrade: vi.fn(),
  deleteTrade: vi.fn()
}));

import * as tradeService from '../services/tradeService';
import { useTrades, usePosition, useCreateTrade, useUpdateTrade, useDeleteTrade } from './useTrades';

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return {
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient
  };
}

const mocked = tradeService as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => vi.clearAllMocks());

it('fetches trades scoped to a group and ticker', async () => {
  mocked.getTrades.mockResolvedValue([{ _id: 't1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useTrades('g1', 'AAPL'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getTrades).toHaveBeenCalledWith('g1', 'AAPL');
});

it('does not query while the ticker is still empty', () => {
  const { Wrapper } = wrapper();

  renderHook(() => useTrades('g1', ''), { wrapper: Wrapper });

  expect(mocked.getTrades).not.toHaveBeenCalled();
});

it('fetches the position once a ticker is chosen', async () => {
  mocked.getPosition.mockResolvedValue({ ticker: 'AAPL', quantity: 10 });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => usePosition('AAPL', 'g1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getPosition).toHaveBeenCalledWith('AAPL', 'g1');
});

it('skips the position query when no ticker is selected', () => {
  const { Wrapper } = wrapper();

  renderHook(() => usePosition(null), { wrapper: Wrapper });

  expect(mocked.getPosition).not.toHaveBeenCalled();
});

it('invalidates the derived holding and dashboard after creating a trade', async () => {
  mocked.addTrade.mockResolvedValue({ _id: 't1' });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateTrade(), { wrapper: Wrapper });
  await result.current.mutateAsync({ ticker: 'AAPL', type: 'buy', date: '2024-01-01' });

  const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]);
  expect(keys).toEqual(expect.arrayContaining(['trades', 'position', 'holdings', 'dashboard']));
});

it('invalidates the same keys after updating a trade', async () => {
  mocked.updateTrade.mockResolvedValue({ _id: 't1' });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useUpdateTrade(), { wrapper: Wrapper });
  await result.current.mutateAsync({ id: 't1', data: { quantity: 5 } });

  expect(mocked.updateTrade).toHaveBeenCalledWith('t1', { quantity: 5 });
  expect(invalidate).toHaveBeenCalled();
});

it('invalidates the same keys after deleting a trade', async () => {
  mocked.deleteTrade.mockResolvedValue(undefined);
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDeleteTrade(), { wrapper: Wrapper });
  await result.current.mutateAsync('t1');

  expect(mocked.deleteTrade).toHaveBeenCalledWith('t1');
  const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]);
  expect(keys).toEqual(expect.arrayContaining(['holdings']));
});
