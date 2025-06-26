import axios from 'axios';

const FINANCE_API_URL = import.meta.env.VITE_FINANCE_API_URL || 'http://localhost:4003';

export const getFinanceRecords = async () => {
  const response = await axios.get(`${FINANCE_API_URL}/api/finance-records`);
  return response.data;
};

export const createFinanceRecord = async (data: any) => {
  const response = await axios.post(`${FINANCE_API_URL}/api/finance-records`, data);
  return response.data;
};

export const deleteFinanceRecord = async (id: string) => {
  const response = await axios.delete(`${FINANCE_API_URL}/api/finance-records/${id}`);
  return response.data;
};

export const updateFinanceRecord = async (id: string, data: any) => {
  const response = await axios.put(`${FINANCE_API_URL}/api/finance-records/${id}`, data);
  return response.data;
};
