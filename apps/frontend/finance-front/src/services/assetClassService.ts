import { financeApi } from '../config/financeApi';
import { AssetClass } from '../types';

export const getAssetClasses = async (params?: { groupId?: string }) => {
  const response = await financeApi.get(`/asset-classes`, { params });
  return response.data;
};

export const createAssetClass = async (data: Omit<AssetClass, '_id' | 'createdAt' | 'updatedAt'> & { groupId?: string }) => {
  const response = await financeApi.post(`/asset-classes`, data);
  return response.data;
};

export const deleteAssetClass = async (id: string) => {
  const response = await financeApi.delete(`/asset-classes/${id}`);
  return response.data;
};

export const updateAssetClass = async (id: string, data: Partial<Pick<AssetClass, 'name' | 'description'>>) => {
  const response = await financeApi.put(`/asset-classes/${id}`, data);
  return response.data;
};