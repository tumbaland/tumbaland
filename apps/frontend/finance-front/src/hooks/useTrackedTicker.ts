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
    },
  });
};

export const useDeleteTrackedTicker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTrackedTicker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackedTickers'] });
    },
  });
};