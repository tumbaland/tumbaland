import { financeApi } from '../config/financeApi';
import { ApiResponse, AssetClass } from '../types';

export const getAssetClasses = async (params?: { groupId?: string }): Promise<AssetClass[]> => {
  const response = await financeApi.get<ApiResponse<AssetClass[]>>(`/asset-classes`, { params });
  return response.data;
};

export const createAssetClass = async (data: Omit<AssetClass, '_id' | 'createdAt' | 'updatedAt'> & { groupId?: string }): Promise<AssetClass> => {
  const response = await financeApi.post<ApiResponse<AssetClass>>(`/asset-classes`, data);
  return response.data;
};

export const deleteAssetClass = async (id: string): Promise<void> => {
  const response = await financeApi.delete<ApiResponse<void>>(`/asset-classes/${id}`);
  return response.data;
};

export const updateAssetClass = async (id: string, data: Partial<Pick<AssetClass, 'name' | 'description'>>): Promise<AssetClass> => {
  const response = await financeApi.put<ApiResponse<AssetClass>>(`/asset-classes/${id}`, data);
  return response.data;
};
