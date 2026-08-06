import { Request, Response } from 'express';

jest.mock('../services/transaction.service', () => ({
  getTransactions: jest.fn(),
  getCategories: jest.fn(),
  createTransaction: jest.fn(),
  updateTransaction: jest.fn(),
  deleteTransaction: jest.fn()
}));

jest.mock('../services/budget.service', () => ({
  getBudgets: jest.fn(),
  createBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn()
}));

jest.mock('../services/cashflow.service', () => ({
  getCashflowSummary: jest.fn(),
  DEFAULT_MONTHS: 12
}));

import * as transactionService from '../services/transaction.service';
import * as budgetService from '../services/budget.service';
import { getCashflowSummary } from '../services/cashflow.service';
import {
  getTransactions,
  getCategories,
  getSummary,
  addTransaction,
  editTransaction,
  removeTransaction,
  getBudgets,
  addBudget,
  editBudget,
  removeBudget
} from './transaction.controller';

const mockedTransactions = transactionService as jest.Mocked<typeof transactionService>;
const mockedBudgets = budgetService as jest.Mocked<typeof budgetService>;
const mockedSummary = getCashflowSummary as unknown as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const req = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'u1' }, userGroups: [], query: {}, params: {}, body: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('getTransactions', () => {
  it('scopes to the caller with no filters by default', async () => {
    mockedTransactions.getTransactions.mockResolvedValue([] as never);

    await getTransactions(req(), mockRes());

    expect(mockedTransactions.getTransactions).toHaveBeenCalledWith('u1', [], {
      from: undefined,
      to: undefined,
      type: undefined,
      category: undefined,
      limit: undefined
    });
  });

  it('forwards the date range, type, category and limit', async () => {
    mockedTransactions.getTransactions.mockResolvedValue([] as never);

    await getTransactions(
      req({
        query: { from: '2026-01-01', to: '2026-06-01', type: 'expense', category: 'Rent', limit: '20' }
      } as Partial<Request>),
      mockRes()
    );

    expect(mockedTransactions.getTransactions).toHaveBeenCalledWith('u1', [], {
      from: new Date('2026-01-01'),
      to: new Date('2026-06-01'),
      type: 'expense',
      category: 'Rent',
      limit: 20
    });
  });

  it('rejects a type outside income/expense', async () => {
    await expect(
      getTransactions(req({ query: { type: 'transfer' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('rejects an unparseable date', async () => {
    await expect(
      getTransactions(req({ query: { from: 'last tuesday' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('rejects a non-positive limit', async () => {
    await expect(
      getTransactions(req({ query: { limit: '0' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      getTransactions(req({ query: { groupId: 'g9' }, userGroups: ['g1'] } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });
});

describe('getCategories', () => {
  it('returns the categories in use', async () => {
    mockedTransactions.getCategories.mockResolvedValue(['Rent']);
    const res = mockRes();

    await getCategories(req(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: ['Rent'] }));
  });
});

describe('getSummary', () => {
  it('defaults to a twelve-month window', async () => {
    mockedSummary.mockResolvedValue({ months: [] });

    await getSummary(req(), mockRes());

    expect(mockedSummary).toHaveBeenCalledWith('u1', { months: 12, groupId: undefined });
  });

  it('honours an explicit window and group', async () => {
    mockedSummary.mockResolvedValue({ months: [] });

    await getSummary(
      req({ query: { months: '6', groupId: 'g1' }, userGroups: ['g1'] } as Partial<Request>),
      mockRes()
    );

    expect(mockedSummary).toHaveBeenCalledWith('u1', { months: 6, groupId: 'g1' });
  });

  it('rejects a fractional window', async () => {
    await expect(
      getSummary(req({ query: { months: '1.5' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('transaction writes', () => {
  it('creates and answers 201', async () => {
    mockedTransactions.createTransaction.mockResolvedValue({ _id: 'x1' } as never);
    const res = mockRes();

    await addTransaction(req({ body: { amount: 10 } } as Partial<Request>), res);

    expect(mockedTransactions.createTransaction).toHaveBeenCalledWith({ amount: 10 }, 'u1', []);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates the identified transaction', async () => {
    mockedTransactions.updateTransaction.mockResolvedValue({ _id: 'x1' } as never);

    await editTransaction(req({ params: { id: 'x1' }, body: { amount: 20 } } as Partial<Request>), mockRes());

    expect(mockedTransactions.updateTransaction).toHaveBeenCalledWith('x1', { amount: 20 }, 'u1', []);
  });

  it('deletes the identified transaction', async () => {
    mockedTransactions.deleteTransaction.mockResolvedValue({} as never);

    await removeTransaction(req({ params: { id: 'x1' } } as Partial<Request>), mockRes());

    expect(mockedTransactions.deleteTransaction).toHaveBeenCalledWith('x1', 'u1', []);
  });
});

describe('budget writes', () => {
  it('lists budgets in the caller context', async () => {
    mockedBudgets.getBudgets.mockResolvedValue([] as never);

    await getBudgets(req(), mockRes());

    expect(mockedBudgets.getBudgets).toHaveBeenCalledWith('u1', []);
  });

  it('creates and answers 201', async () => {
    mockedBudgets.createBudget.mockResolvedValue({ _id: 'b1' } as never);
    const res = mockRes();

    await addBudget(req({ body: { category: 'Rent', amount: 800 } } as Partial<Request>), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates the identified budget', async () => {
    mockedBudgets.updateBudget.mockResolvedValue({ _id: 'b1' } as never);

    await editBudget(req({ params: { id: 'b1' }, body: { amount: 900 } } as Partial<Request>), mockRes());

    expect(mockedBudgets.updateBudget).toHaveBeenCalledWith('b1', { amount: 900 }, 'u1', []);
  });

  it('deletes the identified budget', async () => {
    mockedBudgets.deleteBudget.mockResolvedValue({} as never);

    await removeBudget(req({ params: { id: 'b1' } } as Partial<Request>), mockRes());

    expect(mockedBudgets.deleteBudget).toHaveBeenCalledWith('b1', 'u1', []);
  });
});
