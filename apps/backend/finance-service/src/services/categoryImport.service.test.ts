jest.mock('../models/Transaction', () => ({
  __esModule: true,
  default: { find: jest.fn(), bulkWrite: jest.fn(), insertMany: jest.fn() }
}));

jest.mock('../models/CategoryRule', () => ({
  __esModule: true,
  default: { find: jest.fn() }
}));

jest.mock('../models/StatementSettings', () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

import Transaction from '../models/Transaction';
import CategoryRule from '../models/CategoryRule';
import { importCategories } from './categoryImport.service';

const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedBulkWrite = Transaction.bulkWrite as unknown as jest.Mock;
const mockedRuleFind = CategoryRule.find as unknown as jest.Mock;

/** The categorisation rules this owner has taught the app. */
const withRules = (
  rules: Array<{ pattern: string; category: string; type?: string; matchType?: string }>
) =>
  mockedRuleFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(rules) });

beforeEach(() => {
  jest.clearAllMocks();
  withRules([]);
  mockedBulkWrite.mockResolvedValue({});
});

describe('importCategories', () => {
  const ids = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];
  const file = (...rows: string[]) => ['id;date;type;amount;category;note', ...rows].join('\n');

  /** What the database currently holds for the ids the file names. */
  const held = (rows: Array<{ _id: string; category: string }>) =>
    mockedFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) });

  beforeEach(() => {
    held([]);
    mockedBulkWrite.mockResolvedValue({});
  });

  it('applies a changed category', async () => {
    held([{ _id: ids[0], category: 'Uncategorised' }]);

    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;Groceries;RIMI`), {
      userId: 'u1'
    });

    expect(result).toMatchObject({ format: 'tumbaland', updated: 1, unchanged: 0 });
    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne.update).toEqual({ $set: { category: 'Groceries' } });
  });

  it('leaves a row already in that category alone', async () => {
    held([{ _id: ids[0], category: 'Groceries' }]);

    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;Groceries;x`), {
      userId: 'u1'
    });

    expect(result).toMatchObject({ updated: 0, unchanged: 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('reports ids that belong to nobody here rather than creating them', async () => {
    held([]);

    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;Groceries;x`), {
      userId: 'u1'
    });

    expect(result).toMatchObject({ updated: 0, notFound: 1 });
    expect(mockedBulkWrite).not.toHaveBeenCalled();
  });

  it('skips a row with no usable id, rather than throwing on the lookup', async () => {
    const result = await importCategories(
      file('not-an-id;2026-01-01;expense;1,00;Groceries;x', 'also-bad;d;expense;1,00;Rent;y'),
      { userId: 'u1' }
    );

    expect(result.malformed).toBe(2);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('ignores a blank line rather than counting it as malformed', async () => {
    // A trailing newline is normal in a spreadsheet export
    const result = await importCategories(file(';;;;;', ''), { userId: 'u1' });

    expect(result.malformed).toBe(0);
  });

  it('skips a row with an id but no category', async () => {
    const result = await importCategories(file(`${ids[0]};2026-01-01;expense;1,00;;x`), { userId: 'u1' });

    expect(result.malformed).toBe(1);
  });

  it('reads only the category, ignoring reformatted dates and amounts', async () => {
    // A spreadsheet will have rewritten these to the local locale
    held([{ _id: ids[0], category: 'Uncategorised' }]);

    await importCategories(file(`${ids[0]};06/07/2026;expense;15.59 €;Groceries;x`), { userId: 'u1' });

    const [operations] = mockedBulkWrite.mock.calls[0];
    expect(operations[0].updateOne.update.$set).toEqual({ category: 'Groceries' });
  });

  it('groups what it moved by category', async () => {
    held([
      { _id: ids[0], category: 'Uncategorised' },
      { _id: ids[1], category: 'Uncategorised' }
    ]);

    const result = await importCategories(
      file(`${ids[0]};d;expense;1,00;Groceries;x`, `${ids[1]};d;expense;1,00;Groceries;y`),
      { userId: 'u1' }
    );

    expect(result.categories).toEqual([{ category: 'Groceries', count: 2 }]);
  });

  it('scopes the lookup to the caller, so ids cannot reach another owner', async () => {
    await importCategories(file(`${ids[0]};d;expense;1,00;Groceries;x`), {
      userId: 'u1',
      groupId: 'g1',
      userGroups: ['g1']
    });

    expect(mockedFind.mock.calls[0][0]).toMatchObject({ groupId: { $in: ['g1'] } });
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      importCategories(file(`${ids[0]};d;expense;1,00;X;x`), {
        userId: 'u1',
        groupId: 'g9',
        userGroups: ['g1']
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('refuses a file with no category column', async () => {
    await expect(
      importCategories('id;date\nabc;2026-01-01', { userId: 'u1' })
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('does nothing at all for a file with no usable rows', async () => {
    const result = await importCategories(file(), { userId: 'u1' });

    expect(result).toMatchObject({ updated: 0, malformed: 0 });
    expect(mockedFind).not.toHaveBeenCalled();
  });
});
