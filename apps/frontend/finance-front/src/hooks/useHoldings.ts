import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHoldings,
  getClosedPositions,
  addHolding,
  updateHolding,
  deleteHolding,
  Holding
} from '../services/holdingService';

export const useHoldings = (groupId?: string) => {
  return useQuery({
    queryKey: ['holdings', groupId],
    queryFn: () => getHoldings(groupId),
  });
};

/**
 * Keyed under `holdings`, so every change that refreshes the holdings (a trade,
 * an import, an edit) refreshes what sold positions earned as well.
 */
export const useClosedPositions = (groupId?: string) => {
  return useQuery({
    queryKey: ['holdings', 'closed', groupId],
    queryFn: () => getClosedPositions(groupId),
  });
};

export const useCreateHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addHolding,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holdings'] });
      // Creating a holding auto-tracks its ticker on the backend, which also
      // spends from the plan's tracked-ticker allowance.
      void queryClient.invalidateQueries({ queryKey: ['trackedTickers'] });
      void queryClient.invalidateQueries({ queryKey: ['myEntitlements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Holding> }) => updateHolding(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holdings'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holdings'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
