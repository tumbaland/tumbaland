import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/cashflowService', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
  getCashflowSummary: vi.fn(),
  getAnalytics: vi.fn(),
  importStatement: vi.fn(),
  deleteTransaction: vi.fn()
}));

import * as cashflowService from '../services/cashflowService';
import {
  useTransactions,
  useTransactionCategories,
  useCashflowSummary,
  useAnalytics,
  useImportStatement,
  useDeleteTransaction
} from './useCashflow';

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

const mocked = cashflowService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const invalidatedKeys = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]);

beforeEach(() => vi.clearAllMocks());

it('fetches transactions with the given query', async () => {
  mocked.getTransactions.mockResolvedValue({ items: [{ _id: 'x1' }], totals: { count: 1, income: 0, expense: 0, net: 0 }, hasMore: false });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useTransactions({ groupId: 'g1' }), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getTransactions).toHaveBeenCalledWith({ groupId: 'g1' });
});

it('fetches the categories in use', async () => {
  mocked.getCategories.mockResolvedValue(['Rent']);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useTransactionCategories('g1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getCategories).toHaveBeenCalledWith('g1');
});

it('fetches the cash-flow summary', async () => {
  mocked.getCashflowSummary.mockResolvedValue({ months: [] });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useCashflowSummary('g1', 6), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getCashflowSummary).toHaveBeenCalledWith('g1', 6);
});

it('deletes a transaction and invalidates the summary', async () => {
  mocked.deleteTransaction.mockResolvedValue(undefined);
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDeleteTransaction(), { wrapper: Wrapper });
  await result.current.mutateAsync('x1');

  expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining(['cashflowSummary']));
});


it('fetches the analytics report', async () => {
  mocked.getAnalytics.mockResolvedValue({ years: [] });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAnalytics('g1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getAnalytics).toHaveBeenCalledWith('g1');
});

it('invalidates everything downstream after an import', async () => {
  mocked.importStatement.mockResolvedValue({ imported: 3, duplicates: 0 });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useImportStatement(), { wrapper: Wrapper });
  await result.current.mutateAsync({ csv: 'data', groupId: 'g1' });

  expect(mocked.importStatement).toHaveBeenCalledWith('data', 'g1');
  expect(invalidatedKeys(invalidate)).toEqual(
    expect.arrayContaining(['transactions', 'cashflowSummary', 'cashflowAnalytics', 'dashboard'])
  );
});
