import { Request, Response } from 'express';

jest.mock('../services/transaction.service', () => ({
  getTransactions: jest.fn(),
  getCategories: jest.fn(),
  deleteTransaction: jest.fn()
}));

jest.mock('../services/cashflow.service', () => ({
  getCashflowSummary: jest.fn(),
  DEFAULT_MONTHS: 12
}));

jest.mock('../services/analytics.service', () => ({ getAnalytics: jest.fn() }));
jest.mock('../services/transactionImport.service', () => ({ importStatement: jest.fn() }));

import * as transactionService from '../services/transaction.service';
import { getCashflowSummary } from '../services/cashflow.service';
import { getAnalytics } from '../services/analytics.service';
import { importStatement } from '../services/transactionImport.service';
import {
  getTransactions,
  getCategories,
  getSummary,
  getAnalyticsReport,
  importTransactions,
  removeTransaction
} from './transaction.controller';

const mockedTransactions = transactionService as jest.Mocked<typeof transactionService>;
const mockedSummary = getCashflowSummary as unknown as jest.Mock;
const mockedAnalytics = getAnalytics as unknown as jest.Mock;
const mockedImport = importStatement as unknown as jest.Mock;

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
    mockedTransactions.getTransactions.mockResolvedValue({ items: [], totals: { count: 0, income: 0, expense: 0, net: 0 }, hasMore: false } as never);

    await getTransactions(req(), mockRes());

    expect(mockedTransactions.getTransactions).toHaveBeenCalledWith('u1', [], {
      from: undefined,
      to: undefined,
      type: undefined,
      category: undefined,
      search: undefined,
      limit: undefined,
      skip: undefined
    });
  });

  it('forwards the date range, type, category and limit', async () => {
    mockedTransactions.getTransactions.mockResolvedValue({ items: [], totals: { count: 0, income: 0, expense: 0, net: 0 }, hasMore: false } as never);

    await getTransactions(
      req({
        query: {
          from: '2026-01-01', to: '2026-06-01', type: 'expense',
          category: 'Rent', search: 'rimi', limit: '20', skip: '40'
        }
      } as Partial<Request>),
      mockRes()
    );

    expect(mockedTransactions.getTransactions).toHaveBeenCalledWith('u1', [], {
      from: new Date('2026-01-01'),
      to: new Date('2026-06-01'),
      type: 'expense',
      category: 'Rent',
      search: 'rimi',
      limit: 20,
      skip: 40
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
  it('deletes the identified transaction', async () => {
    mockedTransactions.deleteTransaction.mockResolvedValue({} as never);

    await removeTransaction(req({ params: { id: 'x1' } } as Partial<Request>), mockRes());

    expect(mockedTransactions.deleteTransaction).toHaveBeenCalledWith('x1', 'u1', []);
  });
});


describe('getAnalyticsReport', () => {
  it('returns the trend report for the caller context', async () => {
    mockedAnalytics.mockResolvedValue({ years: [] });
    const res = mockRes();

    await getAnalyticsReport(req({ query: { groupId: 'g1' }, userGroups: ['g1'] } as Partial<Request>), res);

    expect(mockedAnalytics).toHaveBeenCalledWith('u1', 'g1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { years: [] } }));
  });

  it('uses the personal context when no group is given', async () => {
    mockedAnalytics.mockResolvedValue({ years: [] });

    await getAnalyticsReport(req(), mockRes());

    expect(mockedAnalytics).toHaveBeenCalledWith('u1', undefined);
  });
});

describe('importTransactions', () => {
  it('passes the raw CSV body through with the caller context', async () => {
    mockedImport.mockResolvedValue({ imported: 3, duplicates: 0, skipped: {}, period: null, rows: 3, categories: [] });

    await importTransactions(
      req({ body: 'csv-text', query: { groupId: 'g1' }, userGroups: ['g1'] } as Partial<Request>),
      mockRes()
    );

    expect(mockedImport).toHaveBeenCalledWith('csv-text', {
      userId: 'u1',
      groupId: 'g1',
      userGroups: ['g1']
    });
  });

  it('reports how many rows were already present', async () => {
    mockedImport.mockResolvedValue({ imported: 2, duplicates: 5, skipped: {}, period: null, rows: 7, categories: [] });
    const res = mockRes();

    await importTransactions(req({ body: 'csv' } as Partial<Request>), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Imported 2; 5 already present' })
    );
  });

  it('sends an empty string when the body never parsed as text', async () => {
    mockedImport.mockResolvedValue({ imported: 0, duplicates: 0, skipped: {}, period: null, rows: 0, categories: [] });

    await importTransactions(req({ body: undefined } as Partial<Request>), mockRes());

    expect(mockedImport).toHaveBeenCalledWith('', expect.any(Object));
  });
});
