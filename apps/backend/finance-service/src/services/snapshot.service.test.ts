jest.mock('../models/Snapshot', () => ({
  __esModule: true,
  default: { find: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn(), findByIdAndDelete: jest.fn() }
}));

import Snapshot from '../models/Snapshot';
import { getSnapshots, upsertSnapshot, deleteSnapshot, monthToDate } from './snapshot.service';

const mockedFind = Snapshot.find as unknown as jest.Mock;
const mockedFindOneAndUpdate = Snapshot.findOneAndUpdate as unknown as jest.Mock;
const mockedFindById = Snapshot.findById as unknown as jest.Mock;
const mockedFindByIdAndDelete = Snapshot.findByIdAndDelete as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('monthToDate', () => {
  it('parses a YYYY-MM key into a UTC first-of-month date', () => {
    expect(monthToDate('2026-03').toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('getSnapshots', () => {
  it('queries by groupId when provided', async () => {
    mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await getSnapshots('user-1', 'g1');
    expect(mockedFind).toHaveBeenCalledWith({ groupId: 'g1' });
  });

  it('queries personal snapshots when no groupId is given', async () => {
    mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await getSnapshots('user-1');
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });
});

describe('upsertSnapshot', () => {
  it('upserts a group snapshot, setting userId only on insert', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 's1' });

    await upsertSnapshot('2026-03', [], 'user-1', 'g1');

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { groupId: 'g1', date: monthToDate('2026-03') },
      { $set: { entries: [] }, $setOnInsert: { userId: 'user-1' } },
      { upsert: true, new: true, runValidators: true }
    );
  });

  it('upserts a personal snapshot when no groupId is given', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 's1' });

    await upsertSnapshot('2026-03', [{ ticker: 'AAPL' } as never], 'user-1');

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', groupId: { $exists: false }, date: monthToDate('2026-03') },
      { $set: { entries: [{ ticker: 'AAPL' }] } },
      { upsert: true, new: true, runValidators: true }
    );
  });
});

describe('deleteSnapshot', () => {
  it('throws NotFoundError when the snapshot does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    await expect(deleteSnapshot('s1', 'user-1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws ForbiddenError when the user cannot access the snapshot', async () => {
    mockedFindById.mockResolvedValue({ userId: 'someone-else', groupId: undefined });
    await expect(deleteSnapshot('s1', 'user-1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('deletes the snapshot for an authorized user', async () => {
    mockedFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    mockedFindByIdAndDelete.mockResolvedValue({ _id: 's1' });

    await deleteSnapshot('s1', 'user-1', []);

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('s1');
  });
});
