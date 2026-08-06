import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrades,
  getPosition,
  addTrade,
  updateTrade,
  deleteTrade,
  Trade,
  TradeInput
} from '../services/tradeService';

/**
 * A trade edit rewrites the derived `Holding`, so anything showing positions —
 * the holdings list, the dashboard — has to be refetched alongside the log.
 */
const invalidateDerived = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['trades'] });
  queryClient.invalidateQueries({ queryKey: ['position'] });
  queryClient.invalidateQueries({ queryKey: ['holdings'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const useTrades = (groupId?: string, ticker?: string) =>
  useQuery<Trade[]>({
    queryKey: ['trades', groupId, ticker],
    queryFn: () => getTrades(groupId, ticker),
    enabled: ticker === undefined || ticker.length > 0
  });

export const usePosition = (ticker: string | null, groupId?: string) =>
  useQuery({
    queryKey: ['position', ticker, groupId],
    queryFn: () => getPosition(ticker as string, groupId),
    enabled: !!ticker
  });

export const useCreateTrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TradeInput) => addTrade(data),
    onSuccess: () => invalidateDerived(queryClient)
  });
};

export const useUpdateTrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TradeInput> }) => updateTrade(id, data),
    onSuccess: () => invalidateDerived(queryClient)
  });
};

export const useDeleteTrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrade(id),
    onSuccess: () => invalidateDerived(queryClient)
  });
};
