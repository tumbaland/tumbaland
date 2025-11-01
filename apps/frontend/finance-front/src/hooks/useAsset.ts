import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssetAllocations,
  createAssetAllocation,
  updateAssetAllocation,
  deleteAssetAllocation
} from '../services/assetAllocationService';
import {
  getAssetClasses,
  createAssetClass,
  updateAssetClass,
  deleteAssetClass
} from '../services/assetClassService';
import { AssetAllocation, AssetClass } from '../types';

// Asset Allocation Hooks
export const useAssetAllocations = (groupId?: string) => {
  return useQuery({
    queryKey: ['assetAllocations', groupId],
    queryFn: () => getAssetAllocations(groupId ? { groupId } : undefined),
  });
};

export const useCreateAssetAllocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAssetAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateAssetAllocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<AssetAllocation, 'assetClassId' | 'totalValue' | 'gain' | 'date'>> }) =>
      updateAssetAllocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteAssetAllocation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAssetAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

// Asset Class Hooks
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
      queryClient.invalidateQueries({ queryKey: ['assetClasses'] });
    },
  });
};

export const useUpdateAssetClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<AssetClass, 'name' | 'description' | 'color'>> }) =>
      updateAssetClass(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetClasses'] });
    },
  });
};

export const useDeleteAssetClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAssetClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetClasses'] });
    },
  });
};