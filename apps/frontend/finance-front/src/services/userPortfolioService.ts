import { financeApi } from '../config/financeApi';

export interface UserPortfolio {
  _id?: string;
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
  latestPrice?: number;
  currentValue?: number;
  valueIncrease?: number;
  percentIncrease?: number;
}

const API_URL = '/user-portfolio';

export const getUserPortfolios = async (): Promise<UserPortfolio[]> => {
  const res = await financeApi.get(API_URL);
  return res.data;
};

export const addUserPortfolio = async (data: Omit<UserPortfolio, '_id'>): Promise<UserPortfolio> => {
  const res = await financeApi.post(API_URL, data);
  return res.data;
};

export const updateUserPortfolio = async (id: string, data: Partial<UserPortfolio>): Promise<UserPortfolio> => {
  const res = await financeApi.put(`${API_URL}/${id}`, data);
  return res.data;
};

export const deleteUserPortfolio = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};
