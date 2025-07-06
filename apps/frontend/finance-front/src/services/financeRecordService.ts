import { financeApi } from '../config/financeApi';

export const getFinanceRecords = async () => {
  const response = await financeApi.get(`/finance-records`);
  return response.data;
};

export const createFinanceRecord = async (data: any) => {
  const response = await financeApi.post(`/finance-records`, data);
  return response.data;
};

export const deleteFinanceRecord = async (id: string) => {
  const response = await financeApi.delete(`/finance-records/${id}`);
  return response.data;
};

export const updateFinanceRecord = async (id: string, data: any) => {
  const response = await financeApi.put(`/finance-records/${id}`, data);
  return response.data;
};

export const fetchFinanceRecords = async () => {
  return financeApi.post('/finance-records/fetch');
};
