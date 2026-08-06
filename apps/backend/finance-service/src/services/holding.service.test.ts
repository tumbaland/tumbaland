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

jest.mock('./fxRate.service', () => ({
  BASE_CURRENCY: 'EUR',
  getRates: jest.fn()
}));

import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { getRates } from './fxRate.service';
import { getAllHoldings, createHolding, updateHolding, deleteHolding } from './holding.service';

const mockedHoldingFind = Holding.find as unknown as jest.Mock;
const mockedHoldingFindById = Holding.findById as unknown as jest.Mock;
const mockedHoldingFindByIdAndUpdate = Holding.findByIdAndUpdate as unknown as jest.Mock;
const mockedHoldingFindByIdAndDelete = Holding.findByIdAndDelete as unknown as jest.Mock;
const mockedTrackedCtor = TrackedTicker as unknown as jest.Mock;
const mockedTrackedFind = TrackedTicker.find as unknown as jest.Mock;
const mockedTrackedFindOne = TrackedTicker.findOne as unknown as jest.Mock;
const mockedAggregate = TickerPriceHistory.aggregate as unknown as jest.Mock;
const mockedGetRates = getRates as unknown as jest.Mock;

function sortable(result: any[]) {
  return { sort: jest.fn().mockResolvedValue(result) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
  mockedTrackedFind.mockResolvedValue([]);
  mockedGetRates.mockResolvedValue(new Map());
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
      costBasis: 1000,
      currentValue: 1500,
      valueIncrease: 500,
      percentIncrease: 50,
      currency: 'EUR',
      baseCurrency: 'EUR',
      fxRate: 1,
      missingFxRate: false
    });
  });

  it('converts a foreign-currency holding into the base currency', async () => {
    const holding = { ticker: 'VOO', quantity: 10, avgBuyPrice: 400, toObject: () => ({ ticker: 'VOO' }) };
    mockedHoldingFind.mockReturnValue(sortable([holding]));
    mockedAggregate.mockResolvedValue([{ _id: 'VOO', latestPrice: 500, athPrice: 520 }]);
    mockedTrackedFind.mockResolvedValue([{ ticker: 'VOO', displayName: 'Vanguard S&P 500', currency: 'USD' }]);
    mockedGetRates.mockResolvedValue(new Map([['USD', 0.9]]));

    const result = await getAllHoldings('user-1', []);

    expect(result[0]).toMatchObject({
      currency: 'USD',
      baseCurrency: 'EUR',
      fxRate: 0.9,
      missingFxRate: false,
      // Per-share amounts stay in the instrument's own currency
      latestPrice: 500,
      // Totals are converted: 10 x 500 x 0.9, 10 x 400 x 0.9, and the gain
      currentValue: 4500,
      costBasis: 3600,
      valueIncrease: 900
    });
  });

  it('leaves the percentage gain unconverted, since it is currency-independent', async () => {
    const holding = { ticker: 'VOO', quantity: 10, avgBuyPrice: 400, toObject: () => ({ ticker: 'VOO' }) };
    mockedHoldingFind.mockReturnValue(sortable([holding]));
    mockedAggregate.mockResolvedValue([{ _id: 'VOO', latestPrice: 500 }]);
    mockedTrackedFind.mockResolvedValue([{ ticker: 'VOO', displayName: 'VOO', currency: 'USD' }]);
    mockedGetRates.mockResolvedValue(new Map([['USD', 0.9]]));

    const result = await getAllHoldings('user-1', []);

    expect(result[0].percentIncrease).toBe(25);
  });

  it('omits the totals rather than mixing currencies when no rate is available', async () => {
    const holding = { ticker: 'VOO', quantity: 10, avgBuyPrice: 400, toObject: () => ({ ticker: 'VOO' }) };
    mockedHoldingFind.mockReturnValue(sortable([holding]));
    mockedAggregate.mockResolvedValue([{ _id: 'VOO', latestPrice: 500 }]);
    mockedTrackedFind.mockResolvedValue([{ ticker: 'VOO', displayName: 'VOO', currency: 'USD' }]);
    mockedGetRates.mockResolvedValue(new Map());

    const result = await getAllHoldings('user-1', []);

    expect(result[0]).toMatchObject({ currency: 'USD', missingFxRate: true });
    expect(result[0].currentValue).toBeUndefined();
    expect(result[0].costBasis).toBeUndefined();
    expect(result[0].valueIncrease).toBeUndefined();
    // Still comparable across currencies
    expect(result[0].percentIncrease).toBe(25);
  });

  it('treats a ticker with no recorded currency as already being in the base currency', async () => {
    const holding = { ticker: 'OLD', quantity: 2, avgBuyPrice: 50, toObject: () => ({ ticker: 'OLD' }) };
    mockedHoldingFind.mockReturnValue(sortable([holding]));
    mockedAggregate.mockResolvedValue([{ _id: 'OLD', latestPrice: 60 }]);
    mockedTrackedFind.mockResolvedValue([{ ticker: 'OLD', displayName: 'Legacy' }]);

    const result = await getAllHoldings('user-1', []);

    expect(result[0]).toMatchObject({ currency: 'EUR', fxRate: 1, missingFxRate: false, currentValue: 120 });
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
