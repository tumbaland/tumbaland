import Transaction, { ITransaction, TransactionType } from '../models/Transaction';
import Budget from '../models/Budget';
import { ForbiddenError, NotFoundError, canAccessResource } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';

export interface TransactionInput {
  date: Date;
  amount: number;
  type: TransactionType;
  category: string;
  note?: string;
  groupId?: string;
}

export interface TransactionQuery {
  from?: Date;
  to?: Date;
  type?: TransactionType;
  category?: string;
  limit?: number;
}

export const MAX_TRANSACTION_LIMIT = 2000;
export const DEFAULT_TRANSACTION_LIMIT = 500;

export const getTransactions = async (
  userId: string,
  userGroups: string[] = [],
  query: TransactionQuery = {}
) => {
  const filter: Record<string, unknown> = { ...tenantScope(userId, userGroups) };

  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {})
    };
  }
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;

  const limit = Math.min(query.limit ?? DEFAULT_TRANSACTION_LIMIT, MAX_TRANSACTION_LIMIT);

  return Transaction.find(filter).sort({ date: -1 }).limit(limit);
};

/** Categories already in use, so the UI can suggest rather than free-type. */
export const getCategories = async (userId: string, userGroups: string[] = []): Promise<string[]> => {
  const [used, budgeted] = await Promise.all([
    Transaction.distinct('category', tenantScope(userId, userGroups)),
    Budget.distinct('category', tenantScope(userId, userGroups))
  ]);

  return [...new Set([...used, ...budgeted])].sort((a, b) => a.localeCompare(b));
};

export const createTransaction = async (
  data: TransactionInput,
  userId: string,
  userGroups: string[] = []
) => {
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  return new Transaction({ ...data, userId }).save();
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

export const updateTransaction = async (
  id: string,
  data: Partial<TransactionInput>,
  userId: string,
  userGroups: string[] = []
) => {
  await findAccessible(id, userId, userGroups);

  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  return Transaction.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

export const deleteTransaction = async (id: string, userId: string, userGroups: string[] = []) => {
  await findAccessible(id, userId, userGroups);
  return Transaction.findByIdAndDelete(id);
};
