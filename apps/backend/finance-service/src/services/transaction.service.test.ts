jest.mock('../models/Transaction', () => {
  const ctor: jest.Mock & Record<string, jest.Mock> = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: 'x1' })
  })) as never;
  ctor.find = jest.fn();
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  ctor.distinct = jest.fn();
  ctor.aggregate = jest.fn();
  ctor.updateMany = jest.fn();
  return { __esModule: true, default: ctor };
});

import Transaction from '../models/Transaction';
import {
  getTransactions,
  getCategories,
  updateCategory,
  recategorise,
  deleteTransaction,
  DEFAULT_TRANSACTION_LIMIT,
  MAX_TRANSACTION_LIMIT
} from './transaction.service';

const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedFindById = Transaction.findById as unknown as jest.Mock;
const mockedFindByIdAndDelete = Transaction.findByIdAndDelete as unknown as jest.Mock;
const mockedDistinct = Transaction.distinct as unknown as jest.Mock;

/** find().sort().skip().limit(), plus the totals aggregation */
const mockQuery = (items: unknown[] = [], totals: unknown[] = []) => {
  const limit = jest.fn().mockResolvedValue(items);
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  mockedFind.mockReturnValue({ sort });
  (Transaction.aggregate as unknown as jest.Mock).mockResolvedValue(totals);
  return { sort, skip, limit };
};

const personalScope = { userId: 'u1', $or: [{ groupId: { $exists: false } }, { groupId: null }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery();
});

describe('getTransactions', () => {
  it('scopes to the caller and caps the result set', async () => {
    const { sort, limit } = mockQuery();

    await getTransactions('u1', []);

    expect(mockedFind).toHaveBeenCalledWith(personalScope);
    // Secondary key on _id keeps paging stable across rows sharing a date
    expect(sort).toHaveBeenCalledWith({ date: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(DEFAULT_TRANSACTION_LIMIT);
  });

  it('scopes to the group when working in one', async () => {
    await getTransactions('u1', ['g1']);

    expect(mockedFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });

  it('pushes the date range, type and category into the query', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-06-01');

    await getTransactions('u1', [], { from, to, type: 'expense', category: 'Rent' });

    expect(mockedFind).toHaveBeenCalledWith({
      ...personalScope,
      date: { $gte: from, $lte: to },
      type: 'expense',
      category: 'Rent'
    });
  });

  it('caps a caller-supplied limit at the maximum', async () => {
    const { limit } = mockQuery();

    await getTransactions('u1', [], { limit: 99_999 });

    expect(limit).toHaveBeenCalledWith(MAX_TRANSACTION_LIMIT);
  });
});

describe('getCategories', () => {
  it('returns the categories in use, deduplicated and sorted', async () => {
    mockedDistinct.mockResolvedValue(['Rent', 'Groceries', 'Rent']);

    expect(await getCategories('u1', [])).toEqual(['Groceries', 'Rent']);
  });

  it('is empty when nothing has been categorised yet', async () => {
    mockedDistinct.mockResolvedValue([]);

    expect(await getCategories('u1', [])).toEqual([]);
  });
});

describe('deleteTransaction', () => {
  it('throws NotFoundError for an unknown id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(deleteTransaction('nope', 'u1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('refuses a transaction belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ _id: 'x1', userId: 'someone-else' });

    await expect(deleteTransaction('x1', 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('deletes an accessible transaction', async () => {
    mockedFindById.mockResolvedValue({ _id: 'x1', userId: 'u1' });
    mockedFindByIdAndDelete.mockResolvedValue({});

    await deleteTransaction('x1', 'u1', []);

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('x1');
  });
});

describe('sorting', () => {
  it('sorts by amount when asked', async () => {
    const { sort } = mockQuery();

    await getTransactions('u1', [], { sort: 'amount', direction: 'asc' });

    expect(sort).toHaveBeenCalledWith({ amount: 1, _id: -1 });
  });

  it('falls back to newest-first for an unknown field', async () => {
    const { sort } = mockQuery();

    await getTransactions('u1', [], { sort: 'nonsense' as never });

    expect(sort).toHaveBeenCalledWith({ date: -1, _id: -1 });
  });
});

describe('updateCategory', () => {
  it('refuses a transaction belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ _id: 'x1', userId: 'someone-else' });

    await expect(updateCategory('x1', 'Rent', 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('writes only the category', async () => {
    mockedFindById.mockResolvedValue({ _id: 'x1', userId: 'u1' });
    (Transaction.findByIdAndUpdate as unknown as jest.Mock).mockResolvedValue({});

    await updateCategory('x1', 'Rent', 'u1', []);

    expect(Transaction.findByIdAndUpdate).toHaveBeenCalledWith(
      'x1', { category: 'Rent' }, { new: true, runValidators: true }
    );
  });
});

describe('recategorise', () => {
  it('moves every row in the source category', async () => {
    (Transaction.updateMany as unknown as jest.Mock).mockResolvedValue({ modifiedCount: 42 });

    const moved = await recategorise({ fromCategory: 'Uncategorised' }, 'Groceries', 'u1', []);

    expect(moved).toBe(42);
    const [filter, update] = (Transaction.updateMany as unknown as jest.Mock).mock.calls[0];
    expect(filter).toMatchObject({ ...personalScope, category: 'Uncategorised' });
    expect(update).toEqual({ $set: { category: 'Groceries' } });
  });

  it('narrows by counterparty text when given one', async () => {
    (Transaction.updateMany as unknown as jest.Mock).mockResolvedValue({ modifiedCount: 3 });

    await recategorise({ fromCategory: 'Uncategorised', search: 'VELOMARKET' }, 'Investments', 'u1', []);

    const [filter] = (Transaction.updateMany as unknown as jest.Mock).mock.calls[0];
    expect(filter.note).toEqual({ $regex: 'VELOMARKET', $options: 'i' });
  });

  it('escapes regex metacharacters in the search text', async () => {
    (Transaction.updateMany as unknown as jest.Mock).mockResolvedValue({ modifiedCount: 0 });

    await recategorise({ fromCategory: 'Uncategorised', search: 'A.B*C' }, 'X', 'u1', []);

    const [filter] = (Transaction.updateMany as unknown as jest.Mock).mock.calls[0];
    expect(filter.note.$regex).toBe('A\\.B\\*C');
  });

  it('reports zero when nothing matched', async () => {
    (Transaction.updateMany as unknown as jest.Mock).mockResolvedValue({});

    expect(await recategorise({ fromCategory: 'Nope' }, 'X', 'u1', [])).toBe(0);
  });
});
