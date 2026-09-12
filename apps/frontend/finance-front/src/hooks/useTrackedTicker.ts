import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrackedTickers,
  addTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker,
  TrackedTicker
} from '../services/trackedTickerService';

// Tracked Ticker Hooks
export const useTrackedTickers = (groupId?: string) => {
  return useQuery({
    queryKey: ['trackedTickers', groupId],
    queryFn: () => getTrackedTickers(groupId),
  });
};

export const useCreateTrackedTicker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTrackedTicker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedTickers'] });
      // The meter moves with the write: adding, pausing or removing a symbol
      // changes what the account is billed for, and a usage bar that only
      // refreshes on reload reads as broken.
      queryClient.invalidateQueries({ queryKey: ['myEntitlements'] });
    },
  });
};

export const useUpdateTrackedTicker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TrackedTicker> }) =>
      updateTrackedTicker(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedTickers'] });
      queryClient.invalidateQueries({ queryKey: ['myEntitlements'] });
      // Renaming the symbol re-points the holdings and trades under it.
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['position'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteTrackedTicker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTrackedTicker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedTickers'] });
      queryClient.invalidateQueries({ queryKey: ['myEntitlements'] });
    },
  });
};