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
jest.mock('../services/recurring.service', () => ({
  getRecurringPayments: jest.fn(),
  DEFAULT_MONTHS: 24
}));
jest.mock('../services/transactionImport.service', () => ({
  importStatement: jest.fn(),
  importCategories: jest.fn(),
  importPensionStatement: jest.fn(),
  detectFormat: jest.fn(),
  FORMAT_LABELS: {
    seb: 'SEB account statement',
    tumbaland: 'Tumbaland export',
    pensionikeskus: 'Pensionikeskus account statement'
  }
}));
jest.mock('../services/pensionStatement.service', () => ({
  decodeStatement: (body: unknown) => (Buffer.isBuffer(body) ? body.toString('utf8') : String(body ?? ''))
}));
jest.mock('../services/transactionExport.service', () => ({ exportTransactions: jest.fn() }));

import * as transactionService from '../services/transaction.service';
import { getCashflowSummary } from '../services/cashflow.service';
import { getAnalytics } from '../services/analytics.service';
import { getRecurringPayments } from '../services/recurring.service';
import {
  importStatement,
  importCategories,
  importPensionStatement,
  detectFormat
} from '../services/transactionImport.service';
import { exportTransactions } from '../services/transactionExport.service';
import {
  getTransactions,
  getCategories,
  getSummary,
  getAnalyticsReport,
  getRecurring,
  importTransactions,
  exportTransactionsCsv,
  removeTransaction
} from './transaction.controller';

const mockedTransactions = transactionService as jest.Mocked<typeof transactionService>;
const mockedSummary = getCashflowSummary as unknown as jest.Mock;
const mockedAnalytics = getAnalytics as unknown as jest.Mock;
const mockedRecurring = getRecurringPayments as unknown as jest.Mock;
const mockedImport = importStatement as unknown as jest.Mock;
const mockedImportCategories = importCategories as unknown as jest.Mock;
const mockedImportPension = importPensionStatement as unknown as jest.Mock;
const mockedDetect = detectFormat as unknown as jest.Mock;
const mockedExport = exportTransactions as unknown as jest.Mock;

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
  beforeEach(() => mockedDetect.mockReturnValue('seb'));

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

  it('rejects a file that is neither shape', async () => {
    mockedDetect.mockReturnValue(null);

    await expect(
      importTransactions(req({ body: 'name,value\nfoo,1' } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('reads a Tumbaland export as categories instead', async () => {
    mockedDetect.mockReturnValue('tumbaland');
    mockedImportCategories.mockResolvedValue({
      format: 'tumbaland', kind: 'categories', updated: 4, unchanged: 0, notFound: 0, malformed: 0, categories: []
    });
    const res = mockRes();

    await importTransactions(req({ body: 'id;category' } as Partial<Request>), res);

    expect(mockedImportCategories).toHaveBeenCalled();
    expect(mockedImport).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Recategorised 4 transactions' })
    );
  });

  it('stops when the declared format disagrees with the file', async () => {
    // Reading a statement as a category list would silently do nothing
    mockedDetect.mockReturnValue('seb');

    await expect(
      importTransactions(req({ body: 'x', query: { format: 'tumbaland' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('routes a Pensionikeskus statement to the pension import', async () => {
    mockedDetect.mockReturnValue('pensionikeskus');
    mockedImportPension.mockResolvedValue({
      format: 'pensionikeskus', kind: 'pension', imported: 7, duplicates: 0, coveredByBank: 3,
      contributions: 10, skipped: {}, period: null, funds: [], byPillar: []
    });
    const res = mockRes();

    await importTransactions(req({ body: 'Sammas' } as Partial<Request>), res);

    expect(mockedImportPension).toHaveBeenCalled();
    expect(mockedImport).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Imported 7 contributions; 3 already paid by bank transfer'
      })
    );
  });

  it('says plainly when a pension statement adds nothing', async () => {
    mockedDetect.mockReturnValue('pensionikeskus');
    mockedImportPension.mockResolvedValue({
      format: 'pensionikeskus', kind: 'pension', imported: 0, duplicates: 7, coveredByBank: 3,
      contributions: 10, skipped: {}, period: null, funds: [], byPillar: []
    });
    const res = mockRes();

    await importTransactions(req({ body: 'Sammas' } as Partial<Request>), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Nothing new to import; 3 already paid by bank transfer'
      })
    );
  });

  it('decodes a Latin-1 body rather than handing through mojibake', async () => {
    mockedDetect.mockReturnValue('seb');
    mockedImport.mockResolvedValue({ imported: 1, duplicates: 0, skipped: {}, period: null, rows: 1, categories: [] });

    await importTransactions(req({ body: Buffer.from('csv-text', 'utf8') } as Partial<Request>), mockRes());

    expect(mockedImport).toHaveBeenCalledWith('csv-text', expect.any(Object));
  });

  it('rejects a format it does not produce', async () => {
    await expect(
      importTransactions(req({ body: 'x', query: { format: 'nonsense' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('exportTransactionsCsv', () => {
  const csvRes = () => {
    const res = mockRes();
    res.setHeader = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() =>
    mockedExport.mockResolvedValue({ csv: 'id;category\n', rows: 1, filename: 'transactions_all.csv' })
  );

  it('sends the CSV as a download', async () => {
    const res = csvRes();

    await exportTransactionsCsv(req(), res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="transactions_all.csv"'
    );
    expect(res.send).toHaveBeenCalledWith('id;category\n');
  });

  it('passes the table filters through, which is the point of the export', async () => {
    await exportTransactionsCsv(
      req({ query: { category: 'Uncategorised', type: 'expense', search: 'rimi' } } as Partial<Request>),
      csvRes()
    );

    expect(mockedExport).toHaveBeenCalledWith('u1', [], expect.objectContaining({
      category: 'Uncategorised',
      type: 'expense',
      search: 'rimi'
    }));
  });

  it('refuses to emit a format it does not produce', async () => {
    // Emitting something claiming to be a bank statement would fabricate a record
    await expect(
      exportTransactionsCsv(req({ query: { format: 'seb' } } as Partial<Request>), csvRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('rejects an invalid type filter', async () => {
    await expect(
      exportTransactionsCsv(req({ query: { type: 'transfer' } } as Partial<Request>), csvRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('getRecurring', () => {
  const report = { from: '2024-09-01', to: '2026-09-03', monthlyTotal: 0, yearlyTotal: 0, lapsedCount: 0, payments: [] };

  beforeEach(() => mockedRecurring.mockResolvedValue(report));

  it('looks back two years by default and stays personal without a group', async () => {
    const res = mockRes();

    await getRecurring(req(), res);

    expect(mockedRecurring).toHaveBeenCalledWith('u1', { months: 24, groupId: undefined });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: report }));
  });

  it('scopes to a group the caller belongs to', async () => {
    await getRecurring(req({ query: { groupId: 'g1' }, userGroups: ['g1'] }), mockRes());
    expect(mockedRecurring).toHaveBeenCalledWith('u1', { months: 24, groupId: 'g1' });
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(getRecurring(req({ query: { groupId: 'g9' }, userGroups: [] }), mockRes())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('forwards an explicit window', async () => {
    await getRecurring(req({ query: { months: '12' } }), mockRes());
    expect(mockedRecurring).toHaveBeenCalledWith('u1', { months: 12, groupId: undefined });
  });

  it('rejects a window that is not a positive integer', async () => {
    await expect(getRecurring(req({ query: { months: '0' } }), mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });
});
