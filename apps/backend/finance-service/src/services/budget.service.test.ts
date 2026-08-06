jest.mock('../models/Budget', () => {
  const ctor: jest.Mock & Record<string, jest.Mock> = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: 'b1' })
  })) as never;
  ctor.find = jest.fn();
  ctor.findOne = jest.fn();
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: ctor };
});

import Budget from '../models/Budget';
import { getBudgets, createBudget, updateBudget, deleteBudget } from './budget.service';

const mockedCtor = Budget as unknown as jest.Mock;
const mockedFind = Budget.find as unknown as jest.Mock;
const mockedFindOne = Budget.findOne as unknown as jest.Mock;
const mockedFindById = Budget.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Budget.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Budget.findByIdAndDelete as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
  mockedFindOne.mockResolvedValue(null);
});

describe('getBudgets', () => {
  it('scopes to the caller, sorted by category', async () => {
    await getBudgets('u1', []);

    expect(mockedFind).toHaveBeenCalledWith({
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });

  it('scopes to the group when working in one', async () => {
    await getBudgets('u1', ['g1']);

    expect(mockedFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });
});

describe('createBudget', () => {
  const input = { category: 'Rent', amount: 800 };

  it('stamps the owner onto the saved document', async () => {
    await createBudget(input, 'u1', []);

    expect(mockedCtor).toHaveBeenCalledWith(expect.objectContaining({ ...input, userId: 'u1' }));
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(createBudget({ ...input, groupId: 'g9' }, 'u1', ['g1'])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('rejects a second budget for the same category', async () => {
    mockedFindOne.mockResolvedValue({ _id: 'b1', category: 'Rent' });

    await expect(createBudget(input, 'u1', [])).rejects.toMatchObject({ name: 'ConflictError' });
  });

  it('checks for the duplicate in the target group, not the personal scope', async () => {
    await createBudget({ ...input, groupId: 'g1' }, 'u1', ['g1']);

    expect(mockedFindOne).toHaveBeenCalledWith({ groupId: { $in: ['g1'] }, category: 'Rent' });
  });
});

describe('updateBudget', () => {
  it('throws NotFoundError for an unknown id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(updateBudget('nope', {}, 'u1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('refuses a budget belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ userId: 'someone-else' });

    await expect(updateBudget('b1', {}, 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('applies the patch with validators on', async () => {
    mockedFindById.mockResolvedValue({ userId: 'u1' });
    mockedFindByIdAndUpdate.mockResolvedValue({ amount: 900 });

    await updateBudget('b1', { amount: 900 }, 'u1', []);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('b1', { amount: 900 }, { new: true, runValidators: true });
  });
});

describe('deleteBudget', () => {
  it('throws NotFoundError for an unknown id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(deleteBudget('nope', 'u1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('refuses a budget belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ userId: 'someone-else' });

    await expect(deleteBudget('b1', 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('deletes an accessible budget', async () => {
    mockedFindById.mockResolvedValue({ userId: 'u1' });
    mockedFindByIdAndDelete.mockResolvedValue({});

    await deleteBudget('b1', 'u1', []);

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('b1');
  });
});
