jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: { find: jest.fn(), findById: jest.fn(), findOneAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() }
}));

jest.mock('../models/TrackedTicker', () => ({
  __esModule: true,
  default: { find: jest.fn(), distinct: jest.fn() }
}));

jest.mock('./alphaVantage.service', () => ({
  fetchStockPrice: jest.fn(),
  fetchAndSaveAllStockHistory: jest.fn()
}));

import TickerPriceHistory from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';
import { fetchStockPrice, fetchAndSaveAllStockHistory } from './alphaVantage.service';
import {
  getTickerPriceHistory,
  fetchAndSaveTickerPrices,
  fetchAllTickerHistory,
  deleteTickerPriceRecord,
  DEFAULT_PRICE_HISTORY_LIMIT,
  MAX_PRICE_HISTORY_LIMIT
} from './tickerPriceHistory.service';

const mockedFind = TickerPriceHistory.find as unknown as jest.Mock;
const mockedFindById = TickerPriceHistory.findById as unknown as jest.Mock;
const mockedFindOneAndUpdate = TickerPriceHistory.findOneAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = TickerPriceHistory.findByIdAndDelete as unknown as jest.Mock;
const mockedTrackedDistinct = TrackedTicker.distinct as unknown as jest.Mock;
const mockedFetchStockPrice = fetchStockPrice as jest.Mock;
const mockedFetchAllHistory = fetchAndSaveAllStockHistory as jest.Mock;

/** Capture what reached Mongo: the chain is find().sort().limit().lean(). */
const mockQuery = (rows: unknown[]) => {
  const lean = jest.fn().mockResolvedValue(rows);
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  mockedFind.mockReturnValue({ sort });
  return { sort, limit, lean };
};

beforeEach(() => jest.clearAllMocks());

describe('getTickerPriceHistory', () => {
  it('restricts the query to the tickers the caller tracks', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL', 'MSFT']);
    mockQuery([]);

    await getTickerPriceHistory('u1', []);

    expect(mockedTrackedDistinct).toHaveBeenCalledWith('ticker', {
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
    expect(mockedFind).toHaveBeenCalledWith({ ticker: { $in: ['AAPL', 'MSFT'] } });
  });

  it('scopes to group tickers when working in a group context', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockQuery([]);

    await getTickerPriceHistory('u1', ['g1', 'g2']);

    expect(mockedTrackedDistinct).toHaveBeenCalledWith('ticker', { groupId: { $in: ['g1', 'g2'] } });
  });

  it('returns nothing, without querying, when the caller tracks no tickers', async () => {
    mockedTrackedDistinct.mockResolvedValue([]);

    expect(await getTickerPriceHistory('u1', [])).toEqual([]);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('refuses a ticker the caller does not track rather than returning it', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);

    expect(await getTickerPriceHistory('u1', [], { ticker: 'TSLA' })).toEqual([]);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('narrows to a single tracked ticker when asked', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL', 'MSFT']);
    mockQuery([]);

    await getTickerPriceHistory('u1', [], { ticker: 'AAPL' });

    expect(mockedFind).toHaveBeenCalledWith({ ticker: { $in: ['AAPL'] } });
  });

  it('pushes the date range into the query', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockQuery([]);
    const from = new Date('2026-01-01');
    const to = new Date('2026-06-01');

    await getTickerPriceHistory('u1', [], { from, to });

    expect(mockedFind).toHaveBeenCalledWith({
      ticker: { $in: ['AAPL'] },
      date: { $gte: from, $lte: to }
    });
  });

  it('sorts in Mongo by ticker asc then date desc and applies the default cap', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    const { sort, limit } = mockQuery([]);

    await getTickerPriceHistory('u1', []);

    expect(sort).toHaveBeenCalledWith({ ticker: 1, date: -1 });
    expect(limit).toHaveBeenCalledWith(DEFAULT_PRICE_HISTORY_LIMIT);
  });

  it('caps a caller-supplied limit at the maximum', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    const { limit } = mockQuery([]);

    await getTickerPriceHistory('u1', [], { limit: 100_000 });

    expect(limit).toHaveBeenCalledWith(MAX_PRICE_HISTORY_LIMIT);
  });

  it('maps records to the response shape', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockQuery([{ _id: { toString: () => '1' }, ticker: 'AAPL', date: new Date('2026-02-01'), price: 20 }]);

    const result = await getTickerPriceHistory('u1', []);

    expect(result).toEqual([
      { _id: '1', ticker: 'AAPL', date: '2026-02-01T00:00:00.000Z', price: 20, open: undefined, high: undefined, low: undefined, volume: undefined }
    ]);
  });
});

describe('fetchAndSaveTickerPrices', () => {
  it('fetches and saves a tracked ticker', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockedFetchStockPrice.mockResolvedValue({ close: 150, open: 148, high: 151, low: 147, volume: 1000 });
    mockedFindOneAndUpdate.mockResolvedValue({
      date: new Date(),
      ticker: 'AAPL',
      price: 150,
      open: 148,
      high: 151,
      low: 147,
      volume: 1000
    });

    const result = await fetchAndSaveTickerPrices('AAPL', 'u1', []);

    expect(mockedFetchStockPrice).toHaveBeenCalledWith('AAPL');
    expect(result).toHaveLength(1);
  });

  it('refuses an untracked ticker without spending a provider call', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);

    await expect(fetchAndSaveTickerPrices('TSLA', 'u1', [])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    expect(mockedFetchStockPrice).not.toHaveBeenCalled();
  });

  it('skips a ticker when fetchStockPrice returns null', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockedFetchStockPrice.mockResolvedValue(null);

    const result = await fetchAndSaveTickerPrices('AAPL', 'u1', []);

    expect(result).toEqual([]);
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts on the same date-only value it writes, so a second run the same day updates in place', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockedFetchStockPrice.mockResolvedValue({ close: 150, open: 148, high: 151, low: 147, volume: 1000 });
    mockedFindOneAndUpdate.mockResolvedValue({ date: new Date(), ticker: 'AAPL', price: 150 });

    await fetchAndSaveTickerPrices('AAPL', 'u1', []);

    const [filter, update] = mockedFindOneAndUpdate.mock.calls[0];
    expect(filter.date).toEqual(update.date);
    expect(filter.date.toISOString()).toBe(filter.date.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  });
});

describe('fetchAllTickerHistory', () => {
  it('throws BadRequestError when ticker is missing', async () => {
    await expect(fetchAllTickerHistory('', 'u1', [])).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('refuses an untracked ticker without spending a provider call', async () => {
    mockedTrackedDistinct.mockResolvedValue([]);

    await expect(fetchAllTickerHistory('AAPL', 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFetchAllHistory).not.toHaveBeenCalled();
  });

  it('delegates to fetchAndSaveAllStockHistory', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockedFetchAllHistory.mockResolvedValue(42);

    expect(await fetchAllTickerHistory('AAPL', 'u1', [])).toBe(42);
  });
});

describe('deleteTickerPriceRecord', () => {
  it('throws BadRequestError when id is missing', async () => {
    await expect(deleteTickerPriceRecord('', 'u1', [])).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('deletes the record and returns the id', async () => {
    mockedFindById.mockResolvedValue({ ticker: 'AAPL' });
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockedFindByIdAndDelete.mockResolvedValue({});

    expect(await deleteTickerPriceRecord('r1', 'u1', [])).toBe('r1');
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('r1');
  });

  it('refuses to delete a record for a ticker the caller does not track', async () => {
    mockedFindById.mockResolvedValue({ ticker: 'TSLA' });
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);

    await expect(deleteTickerPriceRecord('r1', 'u1', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFindByIdAndDelete).not.toHaveBeenCalled();
  });

  it('is a no-op for an id that does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    expect(await deleteTickerPriceRecord('gone', 'u1', [])).toBe('gone');
    expect(mockedFindByIdAndDelete).not.toHaveBeenCalled();
  });
});
