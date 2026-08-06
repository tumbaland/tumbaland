import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError, sendSuccess } from '@tumbaland/backend-core';
import * as transactionService from '../services/transaction.service';
import { getCashflowSummary, DEFAULT_MONTHS } from '../services/cashflow.service';
import { getAnalytics } from '../services/analytics.service';
import { importStatement } from '../services/transactionImport.service';
import { TransactionType } from '../models/Transaction';

function contextGroups(req: Request): string[] {
  const { groupId } = req.query;
  if (!groupId) return [];

  const userGroups = req.userGroups || [];
  if (!userGroups.includes(groupId as string)) {
    throw new ForbiddenError('Access denied');
  }
  return [groupId as string];
}

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(String(value));
  if (isNaN(date.getTime())) {
    throw new BadRequestError(`${field} must be a valid date`);
  }
  return date;
}

function parsePositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestError(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseOffset(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestError(`${field} must be zero or a positive integer`);
  }
  return parsed;
}

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { from, to, type, category, search, limit, skip } = req.query;

  if (type && type !== 'income' && type !== 'expense') {
    throw new BadRequestError('type must be income or expense');
  }

  const page = await transactionService.getTransactions(user.id, contextGroups(req), {
    from: parseDate(from, 'from'),
    to: parseDate(to, 'to'),
    type: type as TransactionType | undefined,
    category: category ? String(category) : undefined,
    search: search ? String(search) : undefined,
    limit: parsePositiveInt(limit, 'limit'),
    skip: parseOffset(skip, 'skip')
  });

  sendSuccess(res, page);
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const categories = await transactionService.getCategories(user.id, contextGroups(req));

  sendSuccess(res, categories);
};

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { groupId, months } = req.query;
  const groups = contextGroups(req);

  const summary = await getCashflowSummary(user.id, {
    months: parsePositiveInt(months, 'months') ?? DEFAULT_MONTHS,
    groupId: groups.length > 0 ? (groupId as string) : undefined
  });

  sendSuccess(res, summary);
};

export const removeTransaction = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await transactionService.deleteTransaction(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Transaction deleted');
};

/** Long-run trends: income and spending year on year, and what moved them. */
export const getAnalyticsReport = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { groupId } = req.query;
  const groups = contextGroups(req);

  const analytics = await getAnalytics(user.id, groups.length > 0 ? (groupId as string) : undefined);

  sendSuccess(res, analytics);
};

/**
 * Import a bank statement. The body is the raw CSV, which is why this route
 * mounts its own text parser rather than relying on the JSON one.
 */
export const importTransactions = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { groupId } = req.query;
  const groups = contextGroups(req);

  const csv = typeof req.body === 'string' ? req.body : '';

  const result = await importStatement(csv, {
    userId: user.id,
    groupId: groups.length > 0 ? (groupId as string) : undefined,
    userGroups: req.userGroups || []
  });

  sendSuccess(
    res,
    result,
    result.duplicates > 0
      ? `Imported ${result.imported}; ${result.duplicates} already present`
      : `Imported ${result.imported} transactions`
  );
};
