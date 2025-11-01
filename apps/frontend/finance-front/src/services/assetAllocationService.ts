import { financeApi } from '../config/financeApi';
import { AssetAllocation } from '../types';

export const getAssetAllocations = async (params?: { groupId?: string }) => {
  const response = await financeApi.get(`/asset-allocations`, { params });
  return response.data;
};

export const createAssetAllocation = async (data: Omit<AssetAllocation, '_id' | 'createdAt' | 'updatedAt'> & { groupId?: string }) => {
  const response = await financeApi.post(`/asset-allocations`, data);
  return response.data;
};

export const deleteAssetAllocation = async (id: string) => {
  const response = await financeApi.delete(`/asset-allocations/${id}`);
  return response.data;
};

export const updateAssetAllocation = async (id: string, data: Partial<Pick<AssetAllocation, 'assetClassId' | 'totalValue' | 'gain' | 'date'>>) => {
  const response = await financeApi.put(`/asset-allocations/${id}`, data);
  return response.data;
};