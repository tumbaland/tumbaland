jest.mock('../models/TrackedTicker', () => {
  const ctor: any = jest.fn().mockImplementation((data: any) => ({ ...data, save: jest.fn().mockResolvedValue({ ...data, _id: 't1' }) }));
  ctor.find = jest.fn();
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: ctor };
});

import TrackedTicker from '../models/TrackedTicker';
import {
  getAllTrackedTickers,
  createTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker
} from './trackedTicker.service';

const mockedCtor = TrackedTicker as unknown as jest.Mock;
const mockedFind = TrackedTicker.find as unknown as jest.Mock;
const mockedFindById = TrackedTicker.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = TrackedTicker.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = TrackedTicker.findByIdAndDelete as unknown as jest.Mock;

function sortable(result: any[]) {
  return { sort: jest.fn().mockResolvedValue(result) };
}

beforeEach(() => jest.clearAllMocks());

describe('getAllTrackedTickers', () => {
  it('queries personal tickers when the user has no groups', async () => {
    mockedFind.mockReturnValue(sortable([]));
    await getAllTrackedTickers('user-1', []);
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('queries group tickers when the user has groups', async () => {
    mockedFind.mockReturnValue(sortable([]));
    await getAllTrackedTickers('user-1', ['g1']);
    expect(mockedFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });
});

describe('createTrackedTicker', () => {
  const input = { ticker: 'AAPL', displayName: 'Apple' };

  it('throws ForbiddenError when the groupId is not one of the user groups', async () => {
    await expect(createTrackedTicker({ ...input, groupId: 'g1' }, 'user-1', [])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('creates the ticker, defaulting isActive to true', async () => {
    await createTrackedTicker(input, 'user-1');
    expect(mockedCtor).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'AAPL', isActive: true }));
  });

  it('respects an explicit isActive:false', async () => {
    await createTrackedTicker({ ...input, isActive: false }, 'user-1');
    expect(mockedCtor).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });
});

describe('updateTrackedTicker', () => {
  it('returns null when the ticker does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    expect(await updateTrackedTicker('t1', {}, 'user-1', [])).toBeNull();
  });

  it('throws ForbiddenError when the user cannot access the ticker', async () => {
    mockedFindById.mockResolvedValue({ userId: 'someone-else', groupId: undefined });
    await expect(updateTrackedTicker('t1', {}, 'user-1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('throws ForbiddenError when reassigning to a group the user is not in', async () => {
    mockedFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    await expect(updateTrackedTicker('t1', { groupId: 'g1' }, 'user-1', [])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('updates the ticker for an authorized user', async () => {
    mockedFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 't1' });

    await updateTrackedTicker('t1', { displayName: 'New' }, 'user-1', []);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('t1', { displayName: 'New' }, { new: true });
  });
});

describe('deleteTrackedTicker', () => {
  it('throws NotFoundError when the ticker does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    await expect(deleteTrackedTicker('t1', 'user-1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws ForbiddenError when the user cannot access the ticker', async () => {
    mockedFindById.mockResolvedValue({ userId: 'someone-else', groupId: undefined });
    await expect(deleteTrackedTicker('t1', 'user-1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('deletes the ticker for an authorized user', async () => {
    mockedFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    mockedFindByIdAndDelete.mockResolvedValue({ _id: 't1' });

    await deleteTrackedTicker('t1', 'user-1', []);

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('t1');
  });
});
