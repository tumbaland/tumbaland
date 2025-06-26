import { apiClient } from '../api/config';

export const getFinanceRecords = async () => {
  const response = await apiClient.get(`/finance-records`);
  return response.data;
};

export const createFinanceRecord = async (data: any) => {
  const response = await apiClient.post(`/finance-records`, data);
  return response.data;
};

export const deleteFinanceRecord = async (id: string) => {
  const response = await apiClient.delete(`/finance-records/${id}`);
  return response.data;
};

export const updateFinanceRecord = async (id: string, data: any) => {
  const response = await apiClient.put(`/finance-records/${id}`, data);
  return response.data;
};
