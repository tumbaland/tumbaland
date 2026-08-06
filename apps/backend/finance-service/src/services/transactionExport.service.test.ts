jest.mock('../models/Transaction', () => ({ __esModule: true, default: { find: jest.fn() } }));

import Transaction from '../models/Transaction';
import { exportTransactions, toCsv, EXPORT_COLUMNS, MAX_EXPORT_ROWS } from './transactionExport.service';

const mockedFind = Transaction.find as unknown as jest.Mock;

/** find().sort().limit().lean() */
const mockRows = (rows: unknown[]) => {
  const lean = jest.fn().mockResolvedValue(rows);
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  mockedFind.mockReturnValue({ sort });
  return { sort, limit };
};

const doc = (over = {}) => ({
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  date: new Date('2026-07-06T00:00:00Z'),
  type: 'expense',
  amount: 15.59,
  category: 'Uncategorised',
  note: 'RIMI · kaart',
  ...over
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRows([]);
});

describe('toCsv', () => {
  it('writes a header and semicolon-separated rows', () => {
    const csv = toCsv([{ a: '1', b: '2' }], ['a', 'b']);

    expect(csv).toContain('a;b');
    expect(csv).toContain('1;2');
  });

  it('leads with a BOM so Excel reads it as UTF-8', () => {
    // Without it every ä and õ in a merchant name is mangled
    expect(toCsv([], ['a'])).toMatch(/^\uFEFF/);
  });

  it('quotes a cell containing the delimiter', () => {
    expect(toCsv([{ a: 'one;two' }], ['a'])).toContain('"one;two"');
  });

  it('escapes an embedded quote by doubling it', () => {
    expect(toCsv([{ a: 'say "hi"' }], ['a'])).toContain('"say ""hi"""');
  });

  it('quotes a cell containing a newline', () => {
    expect(toCsv([{ a: 'one\ntwo' }], ['a'])).toContain('"one\ntwo"');
  });

  it('writes an empty cell for a missing value', () => {
    expect(toCsv([{ a: '1' }], ['a', 'b'])).toContain('1;');
  });
});

describe('exportTransactions', () => {
  it('carries the id, which is what a returning file is matched on', async () => {
    mockRows([doc()]);

    const { csv } = await exportTransactions('u1', []);

    expect(csv).toContain(EXPORT_COLUMNS.join(';'));
    expect(csv).toContain('aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(csv).toContain('Uncategorised');
  });

  it('writes amounts with a comma decimal, matching the delimiter choice', async () => {
    mockRows([doc()]);

    expect((await exportTransactions('u1', [])).csv).toContain('15,59');
  });

  it('writes the date as a plain day', async () => {
    mockRows([doc()]);

    expect((await exportTransactions('u1', [])).csv).toContain('2026-07-06');
  });

  it('honours the same filter as the table', async () => {
    await exportTransactions('u1', [], { category: 'Uncategorised', type: 'expense' });

    expect(mockedFind).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Uncategorised', type: 'expense' })
    );
  });

  it('scopes to the group when working in one', async () => {
    await exportTransactions('u1', ['g1']);

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ groupId: { $in: ['g1'] } }));
  });

  it('caps how much one export can pull', async () => {
    const { limit } = mockRows([]);

    await exportTransactions('u1', []);

    expect(limit).toHaveBeenCalledWith(MAX_EXPORT_ROWS);
  });

  it('names the file after the filter, so exports do not all collide', async () => {
    const { filename } = await exportTransactions('u1', [], { category: 'Uncategorised' });

    expect(filename).toBe('transactions_uncategorised.csv');
  });

  it('names an unfiltered export plainly', async () => {
    expect((await exportTransactions('u1', [])).filename).toBe('transactions_all.csv');
  });

  it('reports how many rows it wrote', async () => {
    mockRows([doc(), doc({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' })]);

    expect((await exportTransactions('u1', [])).rows).toBe(2);
  });

  it('handles a row with no note', async () => {
    mockRows([doc({ note: undefined })]);

    expect((await exportTransactions('u1', [])).csv).toContain('Uncategorised;');
  });
});
