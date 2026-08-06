jest.mock('../models/Trade', () => {
  const ctor: jest.Mock & Record<string, jest.Mock> = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: 't1' })
  })) as never;
  ctor.find = jest.fn();
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/Holding', () => {
  const ctor: jest.Mock & Record<string, jest.Mock> = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data)
  })) as never;
  ctor.findOne = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: ctor };
});

import Trade from '../models/Trade';
import Holding from '../models/Holding';
import {
  getTrades,
  getPosition,
  getPositions,
  createTrade,
  updateTrade,
  deleteTrade,
  syncHoldingFromTrades
} from './trade.service';

const mockedTradeCtor = Trade as unknown as jest.Mock;
const mockedFind = Trade.find as unknown as jest.Mock;
const mockedFindById = Trade.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Trade.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Trade.findByIdAndDelete as unknown as jest.Mock;
const mockedHoldingCtor = Holding as unknown as jest.Mock;
const mockedHoldingFindOne = Holding.findOne as unknown as jest.Mock;
const mockedHoldingDelete = Holding.findByIdAndDelete as unknown as jest.Mock;

const sorted = (rows: unknown[]) => ({ sort: jest.fn().mockResolvedValue(rows) });

const buy = (quantity: number, price: number, date = '2024-01-01') => ({
  ticker: 'AAPL',
  type: 'buy',
  date: new Date(date),
  quantity,
  price,
  amount: 0,
  fees: 0
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedFind.mockReturnValue(sorted([]));
  mockedHoldingFindOne.mockResolvedValue(null);
});

describe('getTrades', () => {
  it('scopes to the caller and returns newest first', async () => {
    await getTrades('u1', []);

    expect(mockedFind).toHaveBeenCalledWith({
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });

  it('scopes to the group when working in one', async () => {
    await getTrades('u1', ['g1']);

    expect(mockedFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });

  it('narrows to one ticker, normalising its case', async () => {
    await getTrades('u1', [], 'aapl');

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'AAPL' }));
  });
});

describe('getPosition', () => {
  it('replays the ticker trades into a position', async () => {
    mockedFind.mockReturnValue(sorted([buy(10, 100), { ...buy(10, 200), date: new Date('2024-02-01') }]));

    const position = await getPosition('AAPL', 'u1', []);

    expect(position.quantity).toBe(20);
    expect(position.avgBuyPrice).toBe(150);
  });

  it('is an empty position when the ticker has no trades', async () => {
    const position = await getPosition('AAPL', 'u1', []);

    expect(position.quantity).toBe(0);
    expect(position.tradeCount).toBe(0);
  });
});

describe('getPositions', () => {
  it('groups trades by ticker and replays each independently', async () => {
    mockedFind.mockReturnValue(
      sorted([buy(10, 100), { ...buy(5, 40), ticker: 'BND' }, { ...buy(10, 200), date: new Date('2024-02-01') }])
    );

    const positions = await getPositions('u1', []);

    expect(positions.get('AAPL')?.quantity).toBe(20);
    expect(positions.get('BND')?.quantity).toBe(5);
  });

  it('is empty when there are no trades at all', async () => {
    expect((await getPositions('u1', [])).size).toBe(0);
  });
});

describe('syncHoldingFromTrades', () => {
  it('does nothing for a ticker with no trades, leaving a hand-entered holding alone', async () => {
    await syncHoldingFromTrades('AAPL', 'u1', []);

    expect(mockedHoldingCtor).not.toHaveBeenCalled();
    expect(mockedHoldingDelete).not.toHaveBeenCalled();
  });

  it('creates the holding when trades exist but no holding does', async () => {
    mockedFind.mockReturnValue(sorted([buy(10, 100)]));

    await syncHoldingFromTrades('AAPL', 'u1', []);

    expect(mockedHoldingCtor).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', quantity: 10, avgBuyPrice: 100, userId: 'u1' })
    );
  });

  it('carries the group through to a newly created holding', async () => {
    mockedFind.mockReturnValue(sorted([buy(10, 100)]));

    await syncHoldingFromTrades('AAPL', 'u1', ['g1'], 'g1');

    expect(mockedHoldingCtor).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
  });

  it('overwrites an existing holding with the replayed figures', async () => {
    const existing = { quantity: 1, avgBuyPrice: 1, save: jest.fn().mockResolvedValue(undefined) };
    mockedFind.mockReturnValue(sorted([buy(10, 100)]));
    mockedHoldingFindOne.mockResolvedValue(existing);

    await syncHoldingFromTrades('AAPL', 'u1', []);

    expect(existing.quantity).toBe(10);
    expect(existing.avgBuyPrice).toBe(100);
    expect(existing.save).toHaveBeenCalled();
  });

  it('deletes the holding once the position is fully sold', async () => {
    const existing = { _id: 'h1', save: jest.fn() };
    mockedFind.mockReturnValue(
      sorted([buy(10, 100), { ...buy(10, 130), type: 'sell', date: new Date('2024-02-01') }])
    );
    mockedHoldingFindOne.mockResolvedValue(existing);

    await syncHoldingFromTrades('AAPL', 'u1', []);

    expect(mockedHoldingDelete).toHaveBeenCalledWith('h1');
    expect(existing.save).not.toHaveBeenCalled();
  });

  it('does not create a holding for a position that closed at zero', async () => {
    mockedFind.mockReturnValue(
      sorted([buy(10, 100), { ...buy(10, 130), type: 'sell', date: new Date('2024-02-01') }])
    );

    await syncHoldingFromTrades('AAPL', 'u1', []);

    expect(mockedHoldingCtor).not.toHaveBeenCalled();
  });
});

describe('createTrade', () => {
  const input = { ticker: 'aapl', type: 'buy' as const, date: new Date('2024-01-01'), quantity: 10, price: 100 };

  it('saves the trade, uppercasing the ticker and defaulting the optional amounts', async () => {
    await createTrade(input, 'u1', []);

    expect(mockedTradeCtor).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', quantity: 10, price: 100, amount: 0, fees: 0, userId: 'u1' })
    );
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(createTrade({ ...input, groupId: 'g9' }, 'u1', ['g1'])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('rejects a buy with no quantity', async () => {
    await expect(createTrade({ ...input, quantity: 0 }, 'u1', [])).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('rejects a sell with no price', async () => {
    await expect(
      createTrade({ ticker: 'AAPL', type: 'sell', date: new Date(), quantity: 1 }, 'u1', [])
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('rejects a dividend with no amount', async () => {
    await expect(
      createTrade({ ticker: 'AAPL', type: 'dividend', date: new Date() }, 'u1', [])
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('accepts a dividend carrying only an amount', async () => {
    await expect(
      createTrade({ ticker: 'AAPL', type: 'dividend', date: new Date(), amount: 40 }, 'u1', [])
    ).resolves.toBeDefined();
  });

  it('refreshes the holding after recording the trade', async () => {
    mockedFind.mockReturnValue(sorted([buy(10, 100)]));

    await createTrade(input, 'u1', []);

    expect(mockedHoldingCtor).toHaveBeenCalled();
  });
});

describe('updateTrade', () => {
  const existing = {
    _id: 't1',
    ticker: 'AAPL',
    type: 'buy',
    userId: 'u1',
    groupId: undefined,
    quantity: 10,
    price: 100,
    amount: 0,
    fees: 0,
    date: new Date('2024-01-01'),
    toObject() {
      return { ...this };
    }
  };

  it('throws NotFoundError for an unknown id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(updateTrade('nope', {}, 'u1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('refuses a trade belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ ...existing, userId: 'someone-else' });

    await expect(updateTrade('t1', {}, 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('validates the merged document, not just the patch', async () => {
    mockedFindById.mockResolvedValue(existing);

    // Switching a buy to a dividend without supplying an amount
    await expect(updateTrade('t1', { type: 'dividend' }, 'u1', [])).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('applies the patch and resyncs the holding', async () => {
    mockedFindById.mockResolvedValue(existing);
    mockedFindByIdAndUpdate.mockResolvedValue({ ...existing, quantity: 20 });

    await updateTrade('t1', { quantity: 20 }, 'u1', []);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('t1', { quantity: 20 }, { new: true });
    expect(mockedHoldingFindOne).toHaveBeenCalled();
  });

  it('resyncs both tickers when a trade is moved to a different one', async () => {
    mockedFindById.mockResolvedValue(existing);
    mockedFindByIdAndUpdate.mockResolvedValue(existing);

    await updateTrade('t1', { ticker: 'msft' }, 'u1', []);

    const syncedTickers = mockedHoldingFindOne.mock.calls.map((c) => c[0].ticker);
    expect(syncedTickers).toEqual(expect.arrayContaining(['AAPL', 'MSFT']));
  });
});

describe('deleteTrade', () => {
  const existing = { _id: 't1', ticker: 'AAPL', userId: 'u1', groupId: undefined };

  it('throws NotFoundError for an unknown id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(deleteTrade('nope', 'u1', [])).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('refuses a trade belonging to someone else', async () => {
    mockedFindById.mockResolvedValue({ ...existing, userId: 'someone-else' });

    await expect(deleteTrade('t1', 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('deletes and resyncs the holding, so removing the last sell restores the position', async () => {
    mockedFindById.mockResolvedValue(existing);
    mockedFindByIdAndDelete.mockResolvedValue(existing);
    mockedFind.mockReturnValue(sorted([buy(10, 100)]));

    await deleteTrade('t1', 'u1', []);

    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('t1');
    expect(mockedHoldingCtor).toHaveBeenCalledWith(expect.objectContaining({ quantity: 10 }));
  });
});
