import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/cashflowService', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
  getCashflowSummary: vi.fn(),
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getBudgets: vi.fn(),
  addBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn()
}));

import * as cashflowService from '../services/cashflowService';
import {
  useTransactions,
  useTransactionCategories,
  useCashflowSummary,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget
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
  mocked.getTransactions.mockResolvedValue([{ _id: 'x1' }]);
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

it('invalidates the summary and dashboard after creating a transaction', async () => {
  mocked.addTransaction.mockResolvedValue({ _id: 'x1' });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateTransaction(), { wrapper: Wrapper });
  await result.current.mutateAsync({ date: '2026-01-05', amount: 40, type: 'expense', category: 'Rent' });

  expect(invalidatedKeys(invalidate)).toEqual(
    expect.arrayContaining(['transactions', 'cashflowSummary', 'transactionCategories', 'dashboard'])
  );
});

it('updates a transaction by id', async () => {
  mocked.updateTransaction.mockResolvedValue({ _id: 'x1' });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateTransaction(), { wrapper: Wrapper });
  await result.current.mutateAsync({ id: 'x1', data: { amount: 60 } });

  expect(mocked.updateTransaction).toHaveBeenCalledWith('x1', { amount: 60 });
});

it('deletes a transaction and invalidates the summary', async () => {
  mocked.deleteTransaction.mockResolvedValue(undefined);
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDeleteTransaction(), { wrapper: Wrapper });
  await result.current.mutateAsync('x1');

  expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining(['cashflowSummary']));
});

it('fetches budgets', async () => {
  mocked.getBudgets.mockResolvedValue([{ _id: 'b1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useBudgets('g1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.getBudgets).toHaveBeenCalledWith('g1');
});

it('invalidates budgets and the summary after creating a budget', async () => {
  mocked.addBudget.mockResolvedValue({ _id: 'b1' });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateBudget(), { wrapper: Wrapper });
  await result.current.mutateAsync({ category: 'Rent', amount: 800 });

  expect(invalidatedKeys(invalidate)).toEqual(
    expect.arrayContaining(['budgets', 'cashflowSummary', 'transactionCategories'])
  );
});

it('updates a budget by id', async () => {
  mocked.updateBudget.mockResolvedValue({ _id: 'b1' });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateBudget(), { wrapper: Wrapper });
  await result.current.mutateAsync({ id: 'b1', data: { amount: 900 } });

  expect(mocked.updateBudget).toHaveBeenCalledWith('b1', { amount: 900 });
});

it('deletes a budget and invalidates budgets', async () => {
  mocked.deleteBudget.mockResolvedValue(undefined);
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDeleteBudget(), { wrapper: Wrapper });
  await result.current.mutateAsync('b1');

  expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining(['budgets']));
});
