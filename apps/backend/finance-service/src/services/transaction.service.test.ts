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
  return { __esModule: true, default: ctor };
});

jest.mock('../models/Budget', () => ({ __esModule: true, default: { distinct: jest.fn() } }));

import Transaction from '../models/Transaction';
import Budget from '../models/Budget';
import {
  getTransactions,
  getCategories,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  DEFAULT_TRANSACTION_LIMIT,
  MAX_TRANSACTION_LIMIT
} from './transaction.service';

const mockedCtor = Transaction as unknown as jest.Mock;
const mockedFind = Transaction.find as unknown as jest.Mock;
const mockedFindById = Transaction.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Transaction.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Transaction.findByIdAndDelete as unknown as jest.Mock;
const mockedDistinct = Transaction.distinct as unknown as jest.Mock;
const mockedBudgetDistinct = Budget.distinct as unknown as jest.Mock;

/** find().sort().limit() */
const mockQuery = () => {
  const limit = jest.fn().mockResolvedValue([]);
  const sort = jest.fn().mockReturnValue({ limit });
  mockedFind.mockReturnValue({ sort });
  return { sort, limit };
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
    expect(sort).toHaveBeenCalledWith({ date: -1 });
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
  it('merges used and budgeted categories, deduplicated and sorted', async () => {
    mockedDistinct.mockResolvedValue(['Rent', 'Groceries']);
    mockedBudgetDistinct.mockResolvedValue(['Rent', 'Travel']);

    expect(await getCategories('u1', [])).toEqual(['Groceries', 'Rent', 'Travel']);
  });

  it('is empty when nothing has been categorised yet', async () => {
    mockedDistinct.mockResolvedValue([]);
    mockedBudgetDistinct.mockResolvedValue([]);

    expect(await getCategories('u1', [])).toEqual([]);
  });
});

describe('createTransaction', () => {
  const input = { date: new Date('2026-01-05'), amount: 40, type: 'expense' as const, category: 'Rent' };

  it('stamps the owner onto the saved document', async () => {
    await createTransaction(input, 'u1', []);

    expect(mockedCtor).toHaveBeenCalledWith(expect.objectContaining({ ...input, userId: 'u1' }));
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(createTransaction({ ...input, groupId: 'g9' }, 'u1', ['g1'])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });
});

describe('updateTransaction', () => {
  const existing = { _id: 'x1', userId: 'u1', groupId: undefined };

  it('throws NotFoundError for an unknown id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(updateTransaction('nope', {}, 'u1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('refuses a transaction belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ ...existing, userId: 'someone-else' });

    await expect(updateTransaction('x1', {}, 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('refuses a move into a group the caller does not belong to', async () => {
    mockedFindById.mockResolvedValue(existing);

    await expect(updateTransaction('x1', { groupId: 'g9' }, 'u1', ['g1'])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('applies the patch with validators on', async () => {
    mockedFindById.mockResolvedValue(existing);
    mockedFindByIdAndUpdate.mockResolvedValue({ ...existing, amount: 90 });

    await updateTransaction('x1', { amount: 90 }, 'u1', []);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('x1', { amount: 90 }, { new: true, runValidators: true });
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
