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
  sort?: 'date' | 'amount';
  direction?: 'asc' | 'desc';
  limit?: number;
  skip?: number;
}

export interface TransactionPage {
  items: Transaction[];
  /** Totals over the whole filtered set, not just the page on screen. */
  totals: { count: number; income: number; expense: number; net: number };
  hasMore: boolean;
}

export interface PeriodTotals {
  income: number;
  /** Everything that left the account, consumption and investing alike. */
  expense: number;
  /** What was actually consumed — `expense` less money moved into assets. */
  consumption: number;
  /** Money moved into crypto, a broker or a savings product. */
  invested: number;
  savings: number;
  savingsRate: number | null;
  /** Months the window covers, so a partial period can be labelled as one. */
  months: number;
  from: string;
  to: string;
}

export interface YearSummary extends PeriodTotals {
  year: number;
  incomeChange: number | null;
  incomeChangePct: number | null;
  expenseChange: number | null;
  expenseChangePct: number | null;
  /** Fewer than twelve months of data — not comparable with a full year. */
  partial: boolean;
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
  /** Everything ever recorded in this category. */
  total: number;
  /** Spend over the trailing twelve months. */
  latest: number;
  /** The twelve months before that — the like-for-like comparison. */
  previous: number;
  change: number;
  changePct: number | null;
  /** `latest` divided by the window length. */
  perMonth: number;
}

export interface Analytics {
  years: YearSummary[];
  months: PeriodPoint[];
  /**
   * The last twelve months of data and the twelve before. Calendar years are
   * the wrong comparison for most of the year, so the headline figures and the
   * category comparisons use these.
   */
  trailing: { current: PeriodTotals; previous: PeriodTotals | null };
  categoryTrends: CategoryTrend[];
  incomeSources: Array<{ category: string; total: number; byYear: Record<number, number> }>;
  /** Category names treated as investing rather than spending. */
  investmentCategories: string[];
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
  if (query.sort) params.sort = query.sort;
  if (query.direction) params.direction = query.direction;
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

export const updateCategory = async (id: string, category: string): Promise<Transaction> => {
  const res = await financeApi.patch<ApiResponse<Transaction>>(`${TRANSACTIONS_URL}/${id}/category`, {
    category
  });
  return res.data;
};

/** Move every row in one category to another, optionally narrowed by text. */
export const recategorise = async (input: {
  fromCategory: string;
  toCategory: string;
  search?: string;
  groupId?: string;
}): Promise<{ updated: number }> => {
  const { groupId, ...body } = input;
  const res = await financeApi.post<ApiResponse<{ updated: number }>>(
    `${TRANSACTIONS_URL}/recategorise`,
    body,
    groupId ? { params: { groupId } } : undefined
  );
  return res.data;
};
