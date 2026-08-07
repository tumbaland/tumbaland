import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/categoryRuleService', () => ({
  getCategoryRules: vi.fn(),
  createCategoryRule: vi.fn(),
  updateCategoryRule: vi.fn(),
  deleteCategoryRule: vi.fn(),
  moveCategoryRule: vi.fn(),
  applyCategoryRules: vi.fn()
}));

import * as service from '../services/categoryRuleService';
import {
  useCategoryRules,
  useCreateCategoryRule,
  useUpdateCategoryRule,
  useDeleteCategoryRule,
  useMoveCategoryRule,
  useApplyCategoryRules
} from './useCategoryRules';

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

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

beforeEach(() => vi.clearAllMocks());

it('fetches the rules for the current context', async () => {
  mocked(service.getCategoryRules).mockResolvedValue([{ _id: 'r1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useCategoryRules('g1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.data).toEqual([{ _id: 'r1' }]));
  expect(service.getCategoryRules).toHaveBeenCalledWith('g1');
});

it('creates a rule, sending the group as scope rather than as a field', async () => {
  mocked(service.createCategoryRule).mockResolvedValue({ _id: 'r1' });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useCreateCategoryRule(), { wrapper: Wrapper });
  await result.current.mutateAsync({ pattern: 'RIMI', category: 'Groceries', groupId: 'g1' });

  expect(service.createCategoryRule).toHaveBeenCalledWith(
    { pattern: 'RIMI', category: 'Groceries' },
    'g1'
  );
});

it('updates a rule by id', async () => {
  mocked(service.updateCategoryRule).mockResolvedValue({ _id: 'r1' });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateCategoryRule(), { wrapper: Wrapper });
  await result.current.mutateAsync({ id: 'r1', category: 'Household' });

  expect(service.updateCategoryRule).toHaveBeenCalledWith('r1', { category: 'Household' });
});

it('deletes a rule', async () => {
  mocked(service.deleteCategoryRule).mockResolvedValue(undefined);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useDeleteCategoryRule(), { wrapper: Wrapper });
  await result.current.mutateAsync('r1');

  expect(service.deleteCategoryRule).toHaveBeenCalledWith('r1');
});

it('moves a rule', async () => {
  mocked(service.moveCategoryRule).mockResolvedValue([]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useMoveCategoryRule(), { wrapper: Wrapper });
  await result.current.mutateAsync({ id: 'r1', direction: 'up', groupId: 'g1' });

  expect(service.moveCategoryRule).toHaveBeenCalledWith('r1', 'up', 'g1');
});

it('refreshes only the rule list when a rule changes', async () => {
  mocked(service.createCategoryRule).mockResolvedValue({ _id: 'r1' });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateCategoryRule(), { wrapper: Wrapper });
  await result.current.mutateAsync({ pattern: 'RIMI', category: 'Groceries' });

  const keys = invalidate.mock.calls.map(([arg]) => arg?.queryKey?.[0]);
  expect(keys).toContain('categoryRules');
  // A rule that has not been applied has changed no transaction yet, so the
  // figures on screen are still correct and refetching them is waste.
  expect(keys).not.toContain('cashflowAnalytics');
});

it('refreshes the figures too when the rules are applied to existing rows', async () => {
  mocked(service.applyCategoryRules).mockResolvedValue({ updated: 3, examined: 9, categories: [] });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useApplyCategoryRules(), { wrapper: Wrapper });
  await result.current.mutateAsync({ onlyUncategorised: true });

  const keys = invalidate.mock.calls.map(([arg]) => arg?.queryKey?.[0]);
  // This one really does rewrite categories, which moves the savings rate and
  // the dashboard's contributions/growth split with it.
  expect(keys).toEqual(
    expect.arrayContaining([
      'categoryRules',
      'transactions',
      'cashflowSummary',
      'cashflowAnalytics',
      'transactionCategories',
      'dashboard'
    ])
  );
});
