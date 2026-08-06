import { financeApi } from './financeApi';
import { ApiResponse } from '../types';

export type TradeType = 'buy' | 'sell' | 'dividend' | 'fee';

export interface Trade {
  _id?: string;
  ticker: string;
  type: TradeType;
  date: string;
  /** Shares — buy and sell only. */
  quantity: number;
  /** Per share — buy and sell only. */
  price: number;
  /** Cash total — dividend and fee only. */
  amount: number;
  fees: number;
  notes?: string;
  groupId?: string;
}

export interface Position {
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  costBasis: number;
  realizedGain: number;
  dividends: number;
  fees: number;
  netInvested: number;
  tradeCount: number;
}

export type TradeInput = Omit<Trade, '_id' | 'quantity' | 'price' | 'amount' | 'fees'> &
  Partial<Pick<Trade, 'quantity' | 'price' | 'amount' | 'fees'>>;

const API_URL = '/trades';

export const getTrades = async (groupId?: string, ticker?: string): Promise<Trade[]> => {
  const params: Record<string, string> = {};
  if (groupId) params.groupId = groupId;
  if (ticker) params.ticker = ticker;

  const res = await financeApi.get<ApiResponse<Trade[]>>(API_URL, { params });
  return res.data;
};

export const getPosition = async (ticker: string, groupId?: string): Promise<Position> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<Position>>(`${API_URL}/position/${ticker}`, { params });
  return res.data;
};

export const addTrade = async (data: TradeInput): Promise<Trade> => {
  const res = await financeApi.post<ApiResponse<Trade>>(API_URL, data);
  return res.data;
};

export const updateTrade = async (id: string, data: Partial<TradeInput>): Promise<Trade> => {
  const res = await financeApi.put<ApiResponse<Trade>>(`${API_URL}/${id}`, data);
  return res.data;
};

export const deleteTrade = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};

/** Whether a trade type describes share movement or a plain cash amount. */
export const isShareTrade = (type: TradeType): boolean => type === 'buy' || type === 'sell';

/** The cash value of a trade, whichever shape it takes. */
export const tradeValue = (trade: Trade): number =>
  isShareTrade(trade.type) ? trade.quantity * trade.price : trade.amount;
