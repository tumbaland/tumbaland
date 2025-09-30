import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinanceRecords,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  fetchFinanceRecords
} from '../services/financeRecordService';
import {
  getUserPortfolios,
  addUserPortfolio,
  updateUserPortfolio,
  deleteUserPortfolio,
  type UserPortfolio
} from '../services/userPortfolioService';
import {
  getTrackedTickers,
  addTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker,
  type TrackedTicker
} from '../services/trackedTickerService';
import {
  getTickerPriceHistory,
  fetchTickerPriceHistory,
  deleteTickerPriceHistory,
  fetchAllTickerPriceHistory
} from '../services/tickerPriceHistoryService';
import {
  getUserGroups,
  getUserGroupIds
} from '../services/groupService';

// Query keys
export const financeKeys = {
  all: ['finance'] as const,
  records: () => [...financeKeys.all, 'records'] as const,
  record: (id: string) => [...financeKeys.all, 'record', id] as const,
  recordsByGroup: (groupId?: string) => [...financeKeys.records(), 'group', groupId || 'all'] as const,
  portfolios: () => [...financeKeys.all, 'portfolios'] as const,
  portfoliosByGroup: (groupId?: string) => [...financeKeys.portfolios(), 'group', groupId || 'all'] as const,
  portfolio: (id: string) => [...financeKeys.all, 'portfolio', id] as const,
  tickers: () => [...financeKeys.all, 'tickers'] as const,
  tickersByGroup: (groupId?: string) => [...financeKeys.tickers(), 'group', groupId || 'all'] as const,
  ticker: (id: string) => [...financeKeys.all, 'ticker', id] as const,
  priceHistory: () => [...financeKeys.all, 'priceHistory'] as const,
  priceHistoryByTicker: (ticker?: string) => [...financeKeys.priceHistory(), 'ticker', ticker || 'all'] as const,
  groups: () => [...financeKeys.all, 'groups'] as const,
  groupIds: () => [...financeKeys.all, 'groupIds'] as const,
};

// Hook to get finance records
export const useFinanceRecords = (groupId?: string) => {
  return useQuery({
    queryKey: financeKeys.recordsByGroup(groupId),
    queryFn: () => getFinanceRecords(groupId ? { groupId } : undefined),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook to create finance record
export const useCreateFinanceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFinanceRecord,
    onSuccess: () => {
      // Invalidate and refetch finance records
      queryClient.invalidateQueries({ queryKey: financeKeys.records() });
    },
  });
};

// Hook to update finance record
export const useUpdateFinanceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateFinanceRecord(id, data),
    onSuccess: () => {
      // Invalidate and refetch finance records
      queryClient.invalidateQueries({ queryKey: financeKeys.records() });
    },
  });
};

// Hook to delete finance record
export const useDeleteFinanceRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFinanceRecord,
    onSuccess: () => {
      // Invalidate and refetch finance records
      queryClient.invalidateQueries({ queryKey: financeKeys.records() });
    },
  });
};

// Hook to fetch finance records from external source
export const useFetchFinanceRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchFinanceRecords,
    onSuccess: () => {
      // Invalidate and refetch finance records after fetching
      queryClient.invalidateQueries({ queryKey: financeKeys.records() });
    },
  });
};

// ===== USER PORTFOLIO HOOKS =====

// Hook to get user portfolios
export const useUserPortfolios = (groupId?: string) => {
  return useQuery({
    queryKey: financeKeys.portfoliosByGroup(groupId),
    queryFn: () => getUserPortfolios(groupId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook to create user portfolio
export const useCreateUserPortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addUserPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.portfolios() });
    },
  });
};

// Hook to update user portfolio
export const useUpdateUserPortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserPortfolio> }) => updateUserPortfolio(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.portfolios() });
    },
  });
};

// Hook to delete user portfolio
export const useDeleteUserPortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUserPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.portfolios() });
    },
  });
};

// ===== TRACKED TICKERS HOOKS =====

// Hook to get tracked tickers
export const useTrackedTickers = (groupId?: string) => {
  return useQuery({
    queryKey: financeKeys.tickersByGroup(groupId),
    queryFn: () => getTrackedTickers(groupId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook to create tracked ticker
export const useCreateTrackedTicker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addTrackedTicker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.tickers() });
    },
  });
};

// Hook to update tracked ticker
export const useUpdateTrackedTicker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TrackedTicker> }) => updateTrackedTicker(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.tickers() });
    },
  });
};

// Hook to delete tracked ticker
export const useDeleteTrackedTicker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTrackedTicker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.tickers() });
    },
  });
};

// ===== TICKER PRICE HISTORY HOOKS =====

// Hook to get ticker price history
export const useTickerPriceHistory = (ticker?: string) => {
  return useQuery({
    queryKey: financeKeys.priceHistoryByTicker(ticker),
    queryFn: () => getTickerPriceHistory(ticker),
    staleTime: 10 * 60 * 1000, // 10 minutes (price data doesn't change often)
    enabled: !!ticker, // Only run if ticker is provided
  });
};

// Hook to fetch ticker price history
export const useFetchTickerPriceHistory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchTickerPriceHistory,
    onSuccess: (_, ticker) => {
      // Invalidate price history for this ticker
      queryClient.invalidateQueries({ queryKey: financeKeys.priceHistoryByTicker(ticker) });
    },
  });
};

// Hook to fetch all ticker price history
export const useFetchAllTickerPriceHistory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchAllTickerPriceHistory,
    onSuccess: () => {
      // Invalidate all price history
      queryClient.invalidateQueries({ queryKey: financeKeys.priceHistory() });
    },
  });
};

// Hook to delete ticker price history
export const useDeleteTickerPriceHistory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTickerPriceHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.priceHistory() });
    },
  });
};

// ===== GROUP HOOKS =====

// Hook to get user groups
export const useUserGroups = () => {
  return useQuery({
    queryKey: financeKeys.groups(),
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook to get user group IDs
export const useUserGroupIds = () => {
  return useQuery({
    queryKey: financeKeys.groupIds(),
    queryFn: getUserGroupIds,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};