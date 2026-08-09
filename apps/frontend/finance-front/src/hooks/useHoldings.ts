import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHoldings, addHolding, updateHolding, deleteHolding, Holding } from '../services/holdingService';

export const useHoldings = (groupId?: string) => {
  return useQuery({
    queryKey: ['holdings', groupId],
    queryFn: () => getHoldings(groupId),
  });
};

export const useCreateHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      // Creating a holding auto-tracks its ticker on the backend, which also
      // spends from the plan's tracked-ticker allowance.
      queryClient.invalidateQueries({ queryKey: ['trackedTickers'] });
      queryClient.invalidateQueries({ queryKey: ['myEntitlements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Holding> }) => updateHolding(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
