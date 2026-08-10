jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    aggregate: jest.fn()
  }
}));

jest.mock('../models/TrackedTicker', () => ({
  __esModule: true,
  default: { find: jest.fn(), distinct: jest.fn() }
}));

jest.mock('./alphaVantage.service', () => ({
  fetchStockPrice: jest.fn(),
  fetchAndSaveAllStockHistory: jest.fn(),
  fetchAndSaveWeeklyHistory: jest.fn()
}));

import TickerPriceHistory from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';
import { fetchStockPrice, fetchAndSaveAllStockHistory, fetchAndSaveWeeklyHistory } from './alphaVantage.service';
import {
  getTickerPriceHistory,
  getTickerCoverage,
  fetchAndSaveTickerPrices,
  fetchAllTickerHistory,
  fetchWeeklyTickerHistory,
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
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL', 'MSFT'] } }));
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

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL'] } }));
  });

  it('pushes the date range into the query', async () => {
    mockedTrackedDistinct.mockResolvedValue(['AAPL']);
    mockQuery([]);
    const from = new Date('2026-01-01');
    const to = new Date('2026-06-01');

    await getTickerPriceHistory('u1', [], { from, to });

    expect(mockedFind).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: { $in: ['AAPL'] }, date: { $gte: from, $lte: to } })
    );
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

describe('retention floor', () => {
  const RETENTION = new Date('2026-05-11T00:00:00.000Z');

  beforeEach(() => mockedTrackedDistinct.mockResolvedValue(['AAPL']));

  it('applies the plan floor when the caller asks for no range', async () => {
    mockQuery([]);

    await getTickerPriceHistory('u1', [], { retentionFrom: RETENTION });

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL'] }, date: { $gte: RETENTION } }));
  });

  it('overrides a wider `from`, so a client cannot ask its way past the plan', async () => {
    mockQuery([]);

    // The planner always asks for two years; on the free tier it gets ninety
    // days, which is the whole gate — there is nothing here to bypass, because
    // the rows are simply not returned.
    await getTickerPriceHistory('u1', [], { from: new Date('2024-08-09T00:00:00.000Z'), retentionFrom: RETENTION });

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL'] }, date: { $gte: RETENTION } }));
  });

  it('keeps a narrower `from`, so a caller can still zoom in', async () => {
    const narrower = new Date('2026-07-01T00:00:00.000Z');
    mockQuery([]);

    await getTickerPriceHistory('u1', [], { from: narrower, retentionFrom: RETENTION });

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL'] }, date: { $gte: narrower } }));
  });

  it('adds no date filter at all for an unlimited plan', async () => {
    mockQuery([]);

    await getTickerPriceHistory('u1', [], { retentionFrom: null });

    // No `date` key at all, not merely a wide one.
    expect(mockedFind.mock.calls[0][0]).not.toHaveProperty('date');
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL'] } }));
  });

  it('still honours `to` alongside the floor', async () => {
    const to = new Date('2026-08-01T00:00:00.000Z');
    mockQuery([]);

    await getTickerPriceHistory('u1', [], { to, retentionFrom: RETENTION });

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $in: ['AAPL'] }, date: { $gte: RETENTION, $lte: to } }));
  });
});


describe('interval separation', () => {
  beforeEach(() => {
    (TrackedTicker.distinct as unknown as jest.Mock).mockResolvedValue(['AAPL']);
    mockedFind.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) })
    });
  });

  it('reads daily by default, and matches rows written before the field existed', async () => {
    await getTickerPriceHistory('u1', [], {});

    // A bare `interval: 'daily'` would exclude every legacy row and empty every
    // chart in the product.
    expect(mockedFind).toHaveBeenCalledWith(
      expect.objectContaining({ interval: { $in: ['daily', null] } })
    );
  });

  it('reads weekly only when asked, and never mixes it with daily', async () => {
    await getTickerPriceHistory('u1', [], { interval: 'weekly' });

    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ interval: 'weekly' }));
  });
});

describe('fetchWeeklyTickerHistory', () => {
  beforeEach(() => {
    (TrackedTicker.distinct as unknown as jest.Mock).mockResolvedValue(['AAPL']);
    (fetchAndSaveWeeklyHistory as jest.Mock).mockResolvedValue(622);
  });

  it('fetches the whole weekly series for a ticker the caller tracks', async () => {
    await expect(fetchWeeklyTickerHistory('AAPL', 'u1', [])).resolves.toBe(622);
    expect(fetchAndSaveWeeklyHistory).toHaveBeenCalledWith('AAPL');
  });

  it('refuses a ticker the caller does not track', async () => {
    (TrackedTicker.distinct as unknown as jest.Mock).mockResolvedValue(['MSFT']);

    await expect(fetchWeeklyTickerHistory('AAPL', 'u1', [])).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    expect(fetchAndSaveWeeklyHistory).not.toHaveBeenCalled();
  });

  it('requires a ticker', async () => {
    await expect(fetchWeeklyTickerHistory('', 'u1', [])).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('getTickerCoverage', () => {
  const aggregate = TickerPriceHistory.aggregate as unknown as jest.Mock;

  beforeEach(() => {
    (TrackedTicker.distinct as unknown as jest.Mock).mockResolvedValue(['AAPL', 'BND']);
  });

  it('reports counts and ranges per interval, per tracked ticker', async () => {
    aggregate.mockResolvedValue([
      {
        _id: { ticker: 'AAPL', interval: 'daily' },
        count: 143,
        first: new Date('2026-01-16T00:00:00.000Z'),
        last: new Date('2026-08-07T00:00:00.000Z')
      },
      {
        _id: { ticker: 'AAPL', interval: 'weekly' },
        count: 622,
        first: new Date('2015-01-20T00:00:00.000Z'),
        last: new Date('2026-08-07T00:00:00.000Z')
      }
    ]);

    const coverage = await getTickerCoverage('u1', []);
    const aapl = coverage.find(c => c.ticker === 'AAPL')!;

    expect(aapl.daily.count).toBe(143);
    expect(aapl.weekly.count).toBe(622);
    expect(aapl.weekly.first).toBe('2015-01-20T00:00:00.000Z');
  });

  it('reports when a fetch last ran separately from the session it retrieved', async () => {
    // The distinction the UI was missing: a Monday-night run that finds no new
    // session still moves `fetchedAt` while `last` stays on Friday. Without it
    // a working job is indistinguishable from a stalled one.
    aggregate.mockResolvedValue([
      {
        _id: { ticker: 'AAPL', interval: 'daily' },
        count: 143,
        first: new Date('2026-01-16T00:00:00.000Z'),
        last: new Date('2026-08-07T00:00:00.000Z'),
        fetchedAt: new Date('2026-08-10T22:00:07.000Z')
      }
    ]);

    const aapl = (await getTickerCoverage('u1', [])).find(c => c.ticker === 'AAPL')!;

    expect(aapl.daily.last).toBe('2026-08-07T00:00:00.000Z');
    expect(aapl.daily.fetchedAt).toBe('2026-08-10T22:00:07.000Z');
  });

  it('has no fetch time for rows written before the collection was timestamped', async () => {
    aggregate.mockResolvedValue([
      {
        _id: { ticker: 'AAPL', interval: 'daily' },
        count: 9,
        first: new Date(0),
        last: new Date(0),
        fetchedAt: null
      }
    ]);

    const aapl = (await getTickerCoverage('u1', [])).find(c => c.ticker === 'AAPL')!;
    expect(aapl.daily.fetchedAt).toBeNull();
  });

  it('reports a tracked ticker with no stored prices as empty rather than omitting it', async () => {
    aggregate.mockResolvedValue([]);

    const coverage = await getTickerCoverage('u1', []);

    // "Nothing stored" is the state the sync UI most needs to show; dropping the
    // row would render it as if the ticker did not exist.
    expect(coverage.map(c => c.ticker)).toEqual(['AAPL', 'BND']);
    expect(coverage[0].daily).toEqual({ count: 0, first: null, last: null, fetchedAt: null });
  });

  it('counts rows written before the interval field as daily', async () => {
    aggregate.mockResolvedValue([
      { _id: { ticker: 'AAPL', interval: 'daily' }, count: 9, first: new Date(0), last: new Date(0) }
    ]);

    const coverage = await getTickerCoverage('u1', []);

    expect(coverage.find(c => c.ticker === 'AAPL')!.daily.count).toBe(9);
    // The aggregation must coalesce the missing field rather than group it separately.
    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $group: expect.objectContaining({
            _id: expect.objectContaining({ interval: { $ifNull: ['$interval', 'daily'] } })
          })
        })
      ])
    );
  });

  it('returns nothing when the caller tracks nothing', async () => {
    (TrackedTicker.distinct as unknown as jest.Mock).mockResolvedValue([]);

    await expect(getTickerCoverage('u1', [])).resolves.toEqual([]);
    expect(aggregate).not.toHaveBeenCalled();
  });
});
