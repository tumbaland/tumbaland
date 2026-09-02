import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/cashflowService', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
  getCashflowSummary: vi.fn(),
  getAnalytics: vi.fn(),
  getRecurring: vi.fn(),
  importStatement: vi.fn(),
  deleteTransaction: vi.fn(),
  updateCategory: vi.fn(),
  recategorise: vi.fn(),
  exportTransactions: vi.fn(),
  saveBlob: vi.fn()
}));

import * as cashflowService from '../services/cashflowService';
import {
  useTransactions,
  useTransactionCategories,
  useCashflowSummary,
  useAnalytics,
  useRecurring,
  useImportStatement,
  useDeleteTransaction,
  useUpdateCategory,
  useRecategorise,
  useExportTransactions
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

  expect(mocked.importStatement).toHaveBeenCalledWith('data', 'g1', undefined);
  expect(invalidatedKeys(invalidate)).toEqual(
    expect.arrayContaining(['transactions', 'cashflowSummary', 'cashflowAnalytics', 'dashboard'])
  );
});

it('passes a declared format through for the server to check', async () => {
  mocked.importStatement.mockResolvedValue({ imported: 3, duplicates: 0 });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useImportStatement(), { wrapper: Wrapper });
  await result.current.mutateAsync({ csv: 'data', groupId: 'g1', format: 'pensionikeskus' });

  expect(mocked.importStatement).toHaveBeenCalledWith('data', 'g1', 'pensionikeskus');
});

it('refreshes the figures after a category is corrected', async () => {
  mocked.updateCategory.mockResolvedValue({ _id: 'x1', category: 'Groceries' });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useUpdateCategory(), { wrapper: Wrapper });
  result.current.mutate({ id: 'x1', category: 'Groceries' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.updateCategory).toHaveBeenCalledWith('x1', 'Groceries');
  expect(invalidatedKeys(invalidate)).toContain('transactions');
});

it('refreshes the figures after a bulk recategorise', async () => {
  mocked.recategorise.mockResolvedValue({ updated: 9 });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useRecategorise(), { wrapper: Wrapper });
  result.current.mutate({ fromCategory: 'Uncategorised', toCategory: 'Groceries' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(invalidatedKeys(invalidate)).toContain('cashflowSummary');
});

it('saves the exported file and reports its name', async () => {
  mocked.exportTransactions.mockResolvedValue({ blob: new Blob(['id;category']), filename: 'transactions_uncategorised.csv' });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useExportTransactions(), { wrapper: Wrapper });
  result.current.mutate({ category: 'Uncategorised' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocked.exportTransactions).toHaveBeenCalledWith({ category: 'Uncategorised' });
  expect(mocked.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'transactions_uncategorised.csv');
  expect(result.current.data).toBe('transactions_uncategorised.csv');
});

it('does not save anything when the export fails', async () => {
  mocked.exportTransactions.mockRejectedValue(new Error('Export failed: 500'));
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useExportTransactions(), { wrapper: Wrapper });
  result.current.mutate({});

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(mocked.saveBlob).not.toHaveBeenCalled();
});

describe('useRecurring', () => {
  it('fetches the recurring report for the current scope', async () => {
    const report = { from: '2024-09-01', to: '2026-09-03', monthlyTotal: 12.17, yearlyTotal: 145.98, lapsedCount: 0, payments: [] };
    (cashflowService.getRecurring as ReturnType<typeof vi.fn>).mockResolvedValue(report);

    const { result } = renderHook(() => useRecurring('g1'), { wrapper: wrapper().Wrapper });

    await waitFor(() => expect(result.current.data).toEqual(report));
    expect(cashflowService.getRecurring).toHaveBeenCalledWith('g1');
  });
});
