import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  moveCategoryRule,
  applyCategoryRules,
  CategoryRule,
  CategoryRuleInput
} from '../services/categoryRuleService';
import { TransactionType } from '../services/cashflowService';

/**
 * Changing a rule changes what the next import does, and applying rules changes
 * categories on rows already held — which moves the savings rate, the category
 * trends and the dashboard's contributions/growth split with it.
 */
const invalidateRules = (queryClient: ReturnType<typeof useQueryClient>, alsoTransactions = false) => {
  queryClient.invalidateQueries({ queryKey: ['categoryRules'] });
  if (!alsoTransactions) return;

  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['cashflowSummary'] });
  queryClient.invalidateQueries({ queryKey: ['cashflowAnalytics'] });
  queryClient.invalidateQueries({ queryKey: ['transactionCategories'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const useCategoryRules = (groupId?: string) =>
  useQuery<CategoryRule[]>({
    queryKey: ['categoryRules', groupId],
    queryFn: () => getCategoryRules(groupId)
  });

export const useCreateCategoryRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...input }: CategoryRuleInput & { groupId?: string }) =>
      createCategoryRule(input, groupId),
    onSuccess: () => invalidateRules(queryClient)
  });
};

export const useUpdateCategoryRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: Omit<Partial<CategoryRuleInput>, 'type'> & { id: string; type?: TransactionType | null }) =>
      updateCategoryRule(id, input),
    onSuccess: () => invalidateRules(queryClient)
  });
};

export const useDeleteCategoryRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategoryRule(id),
    onSuccess: () => invalidateRules(queryClient)
  });
};

export const useMoveCategoryRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      direction,
      groupId
    }: {
      id: string;
      direction: 'up' | 'down';
      groupId?: string;
    }) => moveCategoryRule(id, direction, groupId),
    onSuccess: () => invalidateRules(queryClient)
  });
};

export const useApplyCategoryRules = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyCategoryRules,
    // This one really does rewrite transactions, so everything downstream goes.
    onSuccess: () => invalidateRules(queryClient, true)
  });
};
