import Transaction, { ITransaction, TransactionType } from '../models/Transaction';
import { ForbiddenError, NotFoundError, canAccessResource } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';

export interface TransactionQuery {
  from?: Date;
  to?: Date;
  type?: TransactionType;
  category?: string;
  /** Free text over the note, which carries the counterparty and description. */
  search?: string;
  limit?: number;
  skip?: number;
}

export interface TransactionPage {
  items: ITransaction[];
  /**
   * Totals over everything the filter matches, not just the page. With
   * thousands of rows a page is only a window — summing what it happens to
   * contain would report a number that changes as you scroll.
   */
  totals: { count: number; income: number; expense: number; net: number };
  hasMore: boolean;
}

export const MAX_TRANSACTION_LIMIT = 2000;
export const DEFAULT_TRANSACTION_LIMIT = 500;

/** Escape user input before it becomes part of a regular expression. */
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildFilter = (
  userId: string,
  userGroups: string[],
  query: TransactionQuery
): Record<string, unknown> => {
  const filter: Record<string, unknown> = { ...tenantScope(userId, userGroups) };

  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {})
    };
  }
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.search) filter.note = { $regex: escapeRegex(query.search), $options: 'i' };

  return filter;
};

export const getTransactions = async (
  userId: string,
  userGroups: string[] = [],
  query: TransactionQuery = {}
): Promise<TransactionPage> => {
  const filter = buildFilter(userId, userGroups, query);
  const limit = Math.min(query.limit ?? DEFAULT_TRANSACTION_LIMIT, MAX_TRANSACTION_LIMIT);
  const skip = Math.max(0, query.skip ?? 0);

  const [items, totals] = await Promise.all([
    Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Transaction.aggregate([
      { $match: filter },
      { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ])
  ]);

  const income = totals.find((t) => t._id === 'income');
  const expense = totals.find((t) => t._id === 'expense');
  const count = (income?.count || 0) + (expense?.count || 0);

  return {
    items,
    totals: {
      count,
      income: income?.total || 0,
      expense: expense?.total || 0,
      net: (income?.total || 0) - (expense?.total || 0)
    },
    hasMore: skip + items.length < count
  };
};

/** Categories the imported transactions actually use, for filters and charts. */
export const getCategories = async (userId: string, userGroups: string[] = []): Promise<string[]> => {
  const used: string[] = await Transaction.distinct('category', tenantScope(userId, userGroups));
  return [...new Set(used)].sort((a, b) => a.localeCompare(b));
};

const findAccessible = async (
  id: string,
  userId: string,
  userGroups: string[]
): Promise<ITransaction> => {
  const existing = await Transaction.findById(id);
  if (!existing) {
    throw new NotFoundError('Transaction not found');
  }
  if (!canAccessResource(userId, existing.userId, existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }
  return existing;
};

export const deleteTransaction = async (id: string, userId: string, userGroups: string[] = []) => {
  await findAccessible(id, userId, userGroups);
  return Transaction.findByIdAndDelete(id);
};
