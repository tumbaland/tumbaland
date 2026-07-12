jest.mock('../models/Holding', () => {
  const ctor: any = jest.fn().mockImplementation((data: any) => ({ ...data, save: jest.fn().mockResolvedValue({ ...data, _id: 'h1' }) }));
  ctor.find = jest.fn();
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/TrackedTicker', () => {
  const ctor: any = jest.fn().mockImplementation((data: any) => ({ ...data, save: jest.fn().mockResolvedValue(data) }));
  ctor.find = jest.fn();
  ctor.findOne = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: { aggregate: jest.fn() }
}));

import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { getAllHoldings, createHolding, updateHolding, deleteHolding } from './holding.service';

const mockedHoldingFind = Holding.find as unknown as jest.Mock;
const mockedHoldingFindById = Holding.findById as unknown as jest.Mock;
const mockedHoldingFindByIdAndUpdate = Holding.findByIdAndUpdate as unknown as jest.Mock;
const mockedHoldingFindByIdAndDelete = Holding.findByIdAndDelete as unknown as jest.Mock;
const mockedTrackedCtor = TrackedTicker as unknown as jest.Mock;
const mockedTrackedFind = TrackedTicker.find as unknown as jest.Mock;
const mockedTrackedFindOne = TrackedTicker.findOne as unknown as jest.Mock;
const mockedAggregate = TickerPriceHistory.aggregate as unknown as jest.Mock;

function sortable(result: any[]) {
  return { sort: jest.fn().mockResolvedValue(result) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
  mockedTrackedFind.mockResolvedValue([]);
});

describe('getAllHoldings', () => {
  it('queries personal holdings when the user has no groups', async () => {
    mockedHoldingFind.mockReturnValue(sortable([]));

    await getAllHoldings('user-1', []);

    expect(mockedHoldingFind).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', $or: expect.any(Array) })
    );
  });

  it('queries group holdings when the user has groups', async () => {
    mockedHoldingFind.mockReturnValue(sortable([]));

    await getAllHoldings('user-1', ['g1']);

    expect(mockedHoldingFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });

  it('enriches holdings with latest/ATH price stats and computed values', async () => {
    const holding = { ticker: 'AAPL', quantity: 10, avgBuyPrice: 100, toObject: () => ({ ticker: 'AAPL' }) };
    mockedHoldingFind.mockReturnValue(sortable([holding]));
    mockedAggregate.mockResolvedValue([{ _id: 'AAPL', latestPrice: 150, latestPriceDate: 'd', athPrice: 200 }]);
    mockedTrackedFind.mockResolvedValue([{ ticker: 'AAPL', displayName: 'Apple Inc.' }]);

    const result = await getAllHoldings('user-1', []);

    expect(result[0]).toMatchObject({
      displayName: 'Apple Inc.',
      latestPrice: 150,
      currentValue: 1500,
      valueIncrease: 500,
      percentIncrease: 50
    });
  });

  it('leaves computed price fields undefined when there is no price history for the ticker', async () => {
    const holding = { ticker: 'ZZZZ', quantity: 1, avgBuyPrice: 1, toObject: () => ({ ticker: 'ZZZZ' }) };
    mockedHoldingFind.mockReturnValue(sortable([holding]));

    const result = await getAllHoldings('user-1', []);

    expect(result[0].latestPrice).toBeUndefined();
    expect(result[0].currentValue).toBeUndefined();
  });
});

describe('createHolding', () => {
  const input = { ticker: 'AAPL', quantity: 1, avgBuyPrice: 100 };

  it('throws ForbiddenError when the groupId is not one of the user groups', async () => {
    await expect(createHolding({ ...input, groupId: 'g1' }, 'user-1', [])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('creates the holding and starts tracking a new ticker', async () => {
    mockedTrackedFindOne.mockResolvedValue(null);

    await createHolding(input, 'user-1');

    expect(mockedTrackedCtor).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', userId: 'user-1', isActive: true })
    );
  });

  it('reactivates an existing but inactive tracked ticker instead of creating a new one', async () => {
    const existing: any = { isActive: false, save: jest.fn().mockResolvedValue(undefined) };
    mockedTrackedFindOne.mockResolvedValue(existing);

    await createHolding(input, 'user-1');

    expect(existing.isActive).toBe(true);
    expect(existing.save).toHaveBeenCalledTimes(1);
    expect(mockedTrackedCtor).not.toHaveBeenCalled();
  });

  it('leaves an already-active tracked ticker untouched', async () => {
    const existing: any = { isActive: true, save: jest.fn() };
    mockedTrackedFindOne.mockResolvedValue(existing);

    await createHolding(input, 'user-1');

    expect(existing.save).not.toHaveBeenCalled();
  });

  it('scopes ticker tracking to the group when a groupId is provided', async () => {
    mockedTrackedFindOne.mockResolvedValue(null);

    await createHolding({ ...input, groupId: 'g1' }, 'user-1', ['g1']);

    expect(mockedTrackedFindOne).toHaveBeenCalledWith({ ticker: 'AAPL', groupId: 'g1' });
  });
});

describe('updateHolding', () => {
  it('returns null when the holding does not exist', async () => {
    mockedHoldingFindById.mockResolvedValue(null);
    expect(await updateHolding('h1', {}, 'user-1', [])).toBeNull();
  });

  it('throws ForbiddenError when the user cannot access the holding', async () => {
    mockedHoldingFindById.mockResolvedValue({ userId: 'someone-else', groupId: undefined });
    await expect(updateHolding('h1', {}, 'user-1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('throws ForbiddenError when reassigning to a group the user is not in', async () => {
    mockedHoldingFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    await expect(updateHolding('h1', { groupId: 'g1' }, 'user-1', [])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('updates the holding, dropping displayName (not a Holding field)', async () => {
    mockedHoldingFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    mockedHoldingFindByIdAndUpdate.mockResolvedValue({ _id: 'h1' });

    await updateHolding('h1', { quantity: 5, displayName: 'ignored' } as any, 'user-1', []);

    expect(mockedHoldingFindByIdAndUpdate).toHaveBeenCalledWith('h1', { quantity: 5 }, { new: true });
  });
});

describe('deleteHolding', () => {
  it('throws NotFoundError when the holding does not exist', async () => {
    mockedHoldingFindById.mockResolvedValue(null);
    await expect(deleteHolding('h1', 'user-1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws ForbiddenError when the user cannot access the holding', async () => {
    mockedHoldingFindById.mockResolvedValue({ userId: 'someone-else', groupId: undefined });
    await expect(deleteHolding('h1', 'user-1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('deletes the holding for an authorized user', async () => {
    mockedHoldingFindById.mockResolvedValue({ userId: 'user-1', groupId: undefined });
    mockedHoldingFindByIdAndDelete.mockResolvedValue({ _id: 'h1' });

    await deleteHolding('h1', 'user-1', []);

    expect(mockedHoldingFindByIdAndDelete).toHaveBeenCalledWith('h1');
  });
});
