import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransactions,
  getCategories,
  getCashflowSummary,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getBudgets,
  addBudget,
  updateBudget,
  deleteBudget,
  Transaction,
  Budget,
  TransactionQuery
} from '../services/cashflowService';

/**
 * A transaction change moves the savings rate and the contributions/growth
 * split, both of which the dashboard shows, so those go stale together.
 */
const invalidateCashflow = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['cashflowSummary'] });
  queryClient.invalidateQueries({ queryKey: ['transactionCategories'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const useTransactions = (query: TransactionQuery = {}) =>
  useQuery<Transaction[]>({
    queryKey: ['transactions', query],
    queryFn: () => getTransactions(query)
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

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Transaction, '_id'>) => addTransaction(data),
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) => updateTransaction(id, data),
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => invalidateCashflow(queryClient)
  });
};

const invalidateBudgets = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['budgets'] });
  // Budgets show up as the comparison line in the category summary
  queryClient.invalidateQueries({ queryKey: ['cashflowSummary'] });
  queryClient.invalidateQueries({ queryKey: ['transactionCategories'] });
};

export const useBudgets = (groupId?: string) =>
  useQuery<Budget[]>({
    queryKey: ['budgets', groupId],
    queryFn: () => getBudgets(groupId)
  });

export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Budget, '_id'>) => addBudget(data),
    onSuccess: () => invalidateBudgets(queryClient)
  });
};

export const useUpdateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) => updateBudget(id, data),
    onSuccess: () => invalidateBudgets(queryClient)
  });
};

export const useDeleteBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => invalidateBudgets(queryClient)
  });
};
