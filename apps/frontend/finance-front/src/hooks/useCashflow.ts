import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TransactionFileFormat } from '../services/cashflowService';
import {
  getTransactions,
  getCategories,
  getCashflowSummary,
  getAnalytics,
  getRecurring,
  importStatement,
  exportTransactions,
  saveBlob,
  updateCategory,
  recategorise,
  deleteTransaction,
  TransactionPage,
  TransactionQuery
} from '../services/cashflowService';

/**
 * A transaction change moves the savings rate and the contributions/growth
 * split, both of which the dashboard shows, so those go stale together.
 */
const invalidateCashflow = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ['transactions'] });
  void queryClient.invalidateQueries({ queryKey: ['cashflowSummary'] });
  void queryClient.invalidateQueries({ queryKey: ['cashflowAnalytics'] });
  void queryClient.invalidateQueries({ queryKey: ['cashflowRecurring'] });
  void queryClient.invalidateQueries({ queryKey: ['transactionCategories'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const useImportStatement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      csv,
      groupId,
      format
    }: {
      csv: string | ArrayBuffer;
      groupId?: string;
      format?: TransactionFileFormat;
    }) => importStatement(csv, groupId, format),
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

export const useTransactions = (query: TransactionQuery = {}) =>
  useQuery<TransactionPage>({
    queryKey: ['transactions', query],
    queryFn: () => getTransactions(query),
    // Keep the previous page on screen while the next one loads, so changing a
    // filter does not blank the table and jump the scroll position.
    placeholderData: (previous) => previous
  });

export const useAnalytics = (groupId?: string) =>
  useQuery({
    queryKey: ['cashflowAnalytics', groupId],
    queryFn: () => getAnalytics(groupId)
  });

export const useRecurring = (groupId?: string) =>
  useQuery({
    queryKey: ['cashflowRecurring', groupId],
    queryFn: () => getRecurring(groupId)
  });

export const useTransactionCategories = (groupId?: string) =>
  useQuery<string[]>({
    queryKey: ['transactionCategories', groupId],
    queryFn: () => getCategories(groupId)
  });

export const useCashflowSummary = (groupId?: string, months?: number) =>
  useQuery({
    queryKey: ['cashflowSummary', groupId, months],
    queryFn: () => getCashflowSummary(groupId, months)
  });

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) => updateCategory(id, category),
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

export const useRecategorise = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recategorise,
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

/**
 * Download the rows the current filter matches. Not a query: it is an action
 * with a side effect on the browser, and caching a file download makes no sense.
 */
export const useExportTransactions = () =>
  useMutation({
    mutationFn: async (query: TransactionQuery) => {
      const { blob, filename } = await exportTransactions(query);
      saveBlob(blob, filename);
      return filename;
    }
  });
