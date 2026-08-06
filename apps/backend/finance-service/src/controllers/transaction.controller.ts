import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError, sendSuccess } from '@tumbaland/backend-core';
import * as transactionService from '../services/transaction.service';
import * as budgetService from '../services/budget.service';
import { getCashflowSummary, DEFAULT_MONTHS } from '../services/cashflow.service';
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

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { from, to, type, category, limit } = req.query;

  if (type && type !== 'income' && type !== 'expense') {
    throw new BadRequestError('type must be income or expense');
  }

  const transactions = await transactionService.getTransactions(user.id, contextGroups(req), {
    from: parseDate(from, 'from'),
    to: parseDate(to, 'to'),
    type: type as TransactionType | undefined,
    category: category ? String(category) : undefined,
    limit: parsePositiveInt(limit, 'limit')
  });

  sendSuccess(res, transactions);
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

export const addTransaction = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await transactionService.createTransaction(req.body, user.id, userGroups);

  sendSuccess(res, created, 'Transaction added', 201);
};

export const editTransaction = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await transactionService.updateTransaction(id as string, req.body, user.id, userGroups);

  sendSuccess(res, updated, 'Transaction updated');
};

export const removeTransaction = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await transactionService.deleteTransaction(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Transaction deleted');
};

export const getBudgets = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const budgets = await budgetService.getBudgets(user.id, contextGroups(req));

  sendSuccess(res, budgets);
};

export const addBudget = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await budgetService.createBudget(req.body, user.id, userGroups);

  sendSuccess(res, created, 'Budget created', 201);
};

export const editBudget = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await budgetService.updateBudget(id as string, req.body, user.id, userGroups);

  sendSuccess(res, updated, 'Budget updated');
};

export const removeBudget = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await budgetService.deleteBudget(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Budget deleted');
};
