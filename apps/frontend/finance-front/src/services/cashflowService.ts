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
  /** Free text over the counterparty and description. */
  search?: string;
  limit?: number;
  skip?: number;
}

export interface TransactionPage {
  items: Transaction[];
  /** Totals over the whole filtered set, not just the page on screen. */
  totals: { count: number; income: number; expense: number; net: number };
  hasMore: boolean;
}

export interface YearSummary {
  year: number;
  income: number;
  /** Everything that left the account, consumption and investing alike. */
  expense: number;
  /** What was actually consumed — `expense` less money moved into assets. */
  consumption: number;
  /** Money moved into crypto, a broker or a savings product. */
  invested: number;
  savings: number;
  savingsRate: number | null;
  incomeChange: number | null;
  incomeChangePct: number | null;
  expenseChange: number | null;
  expenseChangePct: number | null;
}

export interface PeriodPoint {
  /** YYYY for a year, YYYY-MM for a month. */
  period: string;
  income: number;
  expense: number;
  savings: number;
}

export interface CategoryTrend {
  category: string;
  byYear: Record<number, number>;
  total: number;
  latest: number;
  previous: number;
  change: number;
  changePct: number | null;
}

export interface Analytics {
  years: YearSummary[];
  /** Category names treated as investing rather than spending. */
  investmentCategories: string[];
  months: PeriodPoint[];
  categoryTrends: CategoryTrend[];
  incomeSources: Array<{ category: string; total: number; byYear: Record<number, number> }>;
  monthlyAverages: Array<{ year: number; income: number; expense: number; months: number }>;
  currency: string;
}

export interface ImportResult {
  imported: number;
  /** Rows already held from an overlapping import, recognised not duplicated. */
  duplicates: number;
  skipped: Record<string, number>;
  period: { from: string; to: string } | null;
  rows: number;
  categories: Array<{ category: string; count: number; amount: number }>;
}

const TRANSACTIONS_URL = '/transactions';

export const getTransactions = async (query: TransactionQuery = {}): Promise<TransactionPage> => {
  const params: Record<string, string> = {};
  if (query.groupId) params.groupId = query.groupId;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.type) params.type = query.type;
  if (query.category) params.category = query.category;
  if (query.search) params.search = query.search;
  if (query.limit !== undefined) params.limit = String(query.limit);
  if (query.skip !== undefined) params.skip = String(query.skip);

  const res = await financeApi.get<ApiResponse<TransactionPage>>(TRANSACTIONS_URL, { params });
  return res.data;
};

export const getAnalytics = async (groupId?: string): Promise<Analytics> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<Analytics>>(`${TRANSACTIONS_URL}/analytics`, { params });
  return res.data;
};

/**
 * Upload a bank statement. Sent as raw CSV rather than JSON because a decade of
 * one account runs to hundreds of kilobytes, well past the JSON body limit.
 */
export const importStatement = async (csv: string, groupId?: string): Promise<ImportResult> => {
  // `request` rather than `post`: post JSON-stringifies its body, which would
  // wrap the whole file in quotes and escape every newline. The statement has
  // to reach the server as the bytes the bank produced.
  const res = await financeApi.request<ApiResponse<ImportResult>>(`${TRANSACTIONS_URL}/import`, {
    method: 'POST',
    body: csv,
    headers: { 'Content-Type': 'text/csv' },
    ...(groupId ? { params: { groupId } } : {})
  });
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

export const deleteTransaction = async (id: string): Promise<void> => {
  await financeApi.delete(`${TRANSACTIONS_URL}/${id}`);
};
