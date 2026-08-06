import { financeApi } from './financeApi';
import { ApiResponse } from '../types';

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  _id?: string;
  date: string;
  /** Always positive; `type` carries the direction. */
  amount: number;
  type: TransactionType;
  category: string;
  note?: string;
  groupId?: string;
}

export interface Budget {
  _id?: string;
  category: string;
  amount: number;
  groupId?: string;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  savings: number;
  /** Null when no income came in that month to save a share of. */
  savingsRate: number | null;
}

export interface CategorySummary {
  category: string;
  /** Monthly average over the months that have transactions. */
  spent: number;
  budget: number | null;
  variance: number | null;
}

export interface GrowthBreakdown {
  from: string;
  to: string;
  netWorthChange: number;
  contributions: number;
  marketGrowth: number;
  /** False when the period is not fully covered by transactions. */
  complete: boolean;
}

export interface CashflowSummary {
  months: MonthSummary[];
  categories: CategorySummary[];
  totals: MonthSummary;
  growth: GrowthBreakdown | null;
}

export interface TransactionQuery {
  groupId?: string;
  from?: string;
  to?: string;
  type?: TransactionType;
  category?: string;
  limit?: number;
}

const TRANSACTIONS_URL = '/transactions';
const BUDGETS_URL = '/budgets';

export const getTransactions = async (query: TransactionQuery = {}): Promise<Transaction[]> => {
  const params: Record<string, string> = {};
  if (query.groupId) params.groupId = query.groupId;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.type) params.type = query.type;
  if (query.category) params.category = query.category;
  if (query.limit !== undefined) params.limit = String(query.limit);

  const res = await financeApi.get<ApiResponse<Transaction[]>>(TRANSACTIONS_URL, { params });
  return res.data;
};

export const getCategories = async (groupId?: string): Promise<string[]> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<string[]>>(`${TRANSACTIONS_URL}/categories`, { params });
  return res.data;
};

export const getCashflowSummary = async (groupId?: string, months?: number): Promise<CashflowSummary> => {
  const params: Record<string, string> = {};
  if (groupId) params.groupId = groupId;
  if (months !== undefined) params.months = String(months);

  const res = await financeApi.get<ApiResponse<CashflowSummary>>(`${TRANSACTIONS_URL}/summary`, { params });
  return res.data;
};

export const addTransaction = async (data: Omit<Transaction, '_id'>): Promise<Transaction> => {
  const res = await financeApi.post<ApiResponse<Transaction>>(TRANSACTIONS_URL, data);
  return res.data;
};

export const updateTransaction = async (
  id: string,
  data: Partial<Transaction>
): Promise<Transaction> => {
  const res = await financeApi.put<ApiResponse<Transaction>>(`${TRANSACTIONS_URL}/${id}`, data);
  return res.data;
};

export const deleteTransaction = async (id: string): Promise<void> => {
  await financeApi.delete(`${TRANSACTIONS_URL}/${id}`);
};

export const getBudgets = async (groupId?: string): Promise<Budget[]> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<Budget[]>>(BUDGETS_URL, { params });
  return res.data;
};

export const addBudget = async (data: Omit<Budget, '_id'>): Promise<Budget> => {
  const res = await financeApi.post<ApiResponse<Budget>>(BUDGETS_URL, data);
  return res.data;
};

export const updateBudget = async (id: string, data: Partial<Budget>): Promise<Budget> => {
  const res = await financeApi.put<ApiResponse<Budget>>(`${BUDGETS_URL}/${id}`, data);
  return res.data;
};

export const deleteBudget = async (id: string): Promise<void> => {
  await financeApi.delete(`${BUDGETS_URL}/${id}`);
};
