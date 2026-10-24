import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssetClasses,
  createAssetClass,
  updateAssetClass,
  deleteAssetClass
} from '../services/assetClassService';
import { AssetClass } from '../types';

export const useAssetClasses = (groupId?: string) => {
  return useQuery({
    queryKey: ['assetClasses', groupId],
    queryFn: () => getAssetClasses(groupId ? { groupId } : undefined),
  });
};

export const useCreateAssetClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAssetClass,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assetClasses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateAssetClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<AssetClass, 'name' | 'description' | 'color' | 'kind'>> }) =>
      updateAssetClass(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assetClasses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteAssetClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAssetClass,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assetClasses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
