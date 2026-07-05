import { financeApi } from '../config/financeApi';
import { ApiResponse, AssetAllocation } from '../types';

export const getAssetAllocations = async (params?: { groupId?: string }): Promise<AssetAllocation[]> => {
  const response = await financeApi.get<ApiResponse<AssetAllocation[]>>(`/asset-allocations`, { params });
  return response.data.data;
};

export const createAssetAllocation = async (data: Omit<AssetAllocation, '_id' | 'createdAt' | 'updatedAt'> & { groupId?: string }): Promise<AssetAllocation> => {
  const response = await financeApi.post<ApiResponse<AssetAllocation>>(`/asset-allocations`, data);
  return response.data.data;
};

export const deleteAssetAllocation = async (id: string): Promise<void> => {
  const response = await financeApi.delete<ApiResponse<void>>(`/asset-allocations/${id}`);
  return response.data.data;
};

export const updateAssetAllocation = async (id: string, data: Partial<Pick<AssetAllocation, 'assetClassId' | 'totalValue' | 'gain' | 'date'>>): Promise<AssetAllocation> => {
  const response = await financeApi.put<ApiResponse<AssetAllocation>>(`/asset-allocations/${id}`, data);
  return response.data.data;
};
