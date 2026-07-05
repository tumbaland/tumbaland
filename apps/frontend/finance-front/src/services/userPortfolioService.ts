import { financeApi } from '../config/financeApi';
import { ApiResponse } from '../types';

export interface UserPortfolio {
  _id?: string;
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
  groupId?: string;
  latestPrice?: number;
  athPrice?: number;
  currentValue?: number;
  valueIncrease?: number;
  percentIncrease?: number;
}

// Shape returned by the backend, which stores the ticker under `symbol`.
type BackendUserPortfolio = Omit<UserPortfolio, 'ticker'> & { symbol?: string; ticker?: string };

const API_URL = '/user-portfolio';

export const getUserPortfolios = async (groupId?: string): Promise<UserPortfolio[]> => {
  const params = new URLSearchParams();
  if (groupId) {
    params.append('groupId', groupId);
  }
  const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
  const res = await financeApi.get<ApiResponse<BackendUserPortfolio[]>>(url);
  // Map backend 'symbol' field to frontend 'ticker' field
  return res.data.data.map(p => ({
    ...p,
    ticker: p.symbol || p.ticker || ''
  }));
};

export const addUserPortfolio = async (data: Omit<UserPortfolio, '_id'>): Promise<UserPortfolio> => {
  const { ticker, ...rest } = data;
  const backendData = { ...rest, symbol: ticker };

  const res = await financeApi.post<ApiResponse<BackendUserPortfolio>>(API_URL, backendData);
  // Map backend 'symbol' field to frontend 'ticker' field
  const portfolio = res.data.data;
  return {
    ...portfolio,
    ticker: portfolio.symbol || portfolio.ticker || ''
  };
};

export const updateUserPortfolio = async (id: string, data: Partial<UserPortfolio>): Promise<UserPortfolio> => {
  // Map frontend 'ticker' field to backend 'symbol' field
  const backendData = { ...data };
  if ('ticker' in backendData) {
    (backendData as any).symbol = backendData.ticker;
    delete (backendData as any).ticker;
  }

  const res = await financeApi.put<ApiResponse<BackendUserPortfolio>>(`${API_URL}/${id}`, backendData);
  // Map backend 'symbol' field to frontend 'ticker' field
  const portfolio = res.data.data;
  return {
    ...portfolio,
    ticker: portfolio.symbol || portfolio.ticker || ''
  };
};

export const deleteUserPortfolio = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};
