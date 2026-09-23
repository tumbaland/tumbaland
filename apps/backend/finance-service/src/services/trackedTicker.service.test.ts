jest.mock('../models/TrackedTicker', () => {
  const ctor = jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data, save: jest.fn().mockResolvedValue({ ...data, _id: 't1' }) })) as jest.Mock & Record<string, jest.Mock>;
  ctor.find = jest.fn();
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  ctor.exists = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/Holding', () => ({
  __esModule: true,
  default: { exists: jest.fn(), updateMany: jest.fn() }
}));
jest.mock('../models/Trade', () => ({ __esModule: true, default: { updateMany: jest.fn() } }));
jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: { aggregate: jest.fn(), collection: { collectionName: 'tickerpricehistories' } }
}));

import TrackedTicker from '../models/TrackedTicker';
import Holding from '../models/Holding';
import Trade from '../models/Trade';
import TickerPriceHistory from '../models/TickerPriceHistory';
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

function sortable(result: unknown[]) {
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
    expect(TickerPriceHistory.aggregate).not.toHaveBeenCalled();
  });

  describe('renaming the symbol', () => {
    const personal = { userId: 'user-1', $or: [{ groupId: { $exists: false } }, { groupId: null }] };

    beforeEach(() => {
      mockedFindById.mockResolvedValue({ ticker: 'VUSA.DE', userId: 'user-1', groupId: undefined });
      mockedFindByIdAndUpdate.mockResolvedValue({ _id: 't1', ticker: 'VUSA.DEX' });
      (TrackedTicker.exists as jest.Mock).mockResolvedValue(null);
      (Holding.exists as jest.Mock).mockResolvedValue(null);
    });

    it('copies price history to the new symbol, keeping closes it already has', async () => {
      await updateTrackedTicker('t1', { ticker: 'VUSA.DEX' }, 'user-1', []);

      expect(TickerPriceHistory.aggregate).toHaveBeenCalledWith([
        { $match: { ticker: 'VUSA.DE' } },
        { $project: { _id: 0 } },
        { $set: { ticker: 'VUSA.DEX', interval: { $ifNull: ['$interval', 'daily'] } } },
        {
          $merge: {
            into: 'tickerpricehistories',
            on: ['ticker', 'interval', 'date'],
            whenMatched: 'keepExisting',
            whenNotMatched: 'insert'
          }
        }
      ]);
    });

    it("re-points the owner's holdings and trades, and renames the ticker last", async () => {
      await updateTrackedTicker('t1', { ticker: 'VUSA.DEX' }, 'user-1', []);

      const update = { $set: { ticker: 'VUSA.DEX' } };
      expect(Holding.updateMany).toHaveBeenCalledWith({ ...personal, ticker: 'VUSA.DE' }, update);
      expect(Trade.updateMany).toHaveBeenCalledWith({ ...personal, ticker: 'VUSA.DE' }, update);

      // A failure before the rename must leave the old symbol on the ticker, or
      // a retry would see nothing to carry over.
      const renamedAt = mockedFindByIdAndUpdate.mock.invocationCallOrder[0];
      expect((Trade.updateMany as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(renamedAt);
      expect((TickerPriceHistory.aggregate as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(renamedAt);
    });

    it("stays within the group for a group's ticker", async () => {
      mockedFindById.mockResolvedValue({ ticker: 'VUSA.DE', userId: 'user-1', groupId: 'g1' });

      await updateTrackedTicker('t1', { ticker: 'VUSA.DEX' }, 'user-1', ['g1']);

      expect(Holding.updateMany).toHaveBeenCalledWith(
        { groupId: { $in: ['g1'] }, ticker: 'VUSA.DE' },
        { $set: { ticker: 'VUSA.DEX' } }
      );
    });

    it.each([
      ['tracked', () => (TrackedTicker.exists as jest.Mock).mockResolvedValue({ _id: 't2' })],
      ['held', () => (Holding.exists as jest.Mock).mockResolvedValue({ _id: 'h2' })]
    ])('refuses a symbol already %s in the scope, writing nothing', async (_what, arrange) => {
      arrange();

      await expect(updateTrackedTicker('t1', { ticker: 'VUSA.DEX' }, 'user-1', [])).rejects.toMatchObject({
        name: 'ConflictError'
      });

      expect(TrackedTicker.exists).toHaveBeenCalledWith({ ...personal, ticker: 'VUSA.DEX' });
      expect(TickerPriceHistory.aggregate).not.toHaveBeenCalled();
      expect(Holding.updateMany).not.toHaveBeenCalled();
      expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('does nothing extra when the symbol sent is the one it already has', async () => {
      await updateTrackedTicker('t1', { ticker: 'VUSA.DE', displayName: 'Vanguard' }, 'user-1', []);

      expect(TrackedTicker.exists).not.toHaveBeenCalled();
      expect(TickerPriceHistory.aggregate).not.toHaveBeenCalled();
    });
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
