jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: { find: jest.fn(), findOneAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() }
}));

jest.mock('../models/TrackedTicker', () => ({
  __esModule: true,
  default: { find: jest.fn() }
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
  fetchAndSaveLatestPrice
} from './tickerPriceHistory.service';

const mockedFind = TickerPriceHistory.find as unknown as jest.Mock;
const mockedFindOneAndUpdate = TickerPriceHistory.findOneAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = TickerPriceHistory.findByIdAndDelete as unknown as jest.Mock;
const mockedTrackedFind = TrackedTicker.find as unknown as jest.Mock;
const mockedFetchStockPrice = fetchStockPrice as jest.Mock;
const mockedFetchAllHistory = fetchAndSaveAllStockHistory as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('getTickerPriceHistory', () => {
  it('maps and sorts records by ticker asc then date desc', async () => {
    mockedFind.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { _id: '1', ticker: 'MSFT', date: new Date('2026-01-01'), price: 10 },
        { _id: '2', ticker: 'AAPL', date: new Date('2026-02-01'), price: 20 },
        { _id: '3', ticker: 'AAPL', date: new Date('2026-01-01'), price: 15 }
      ])
    });

    const result = await getTickerPriceHistory();

    expect(result.map((r) => r.ticker)).toEqual(['AAPL', 'AAPL', 'MSFT']);
    expect(result[0].date >= result[1].date).toBe(true);
  });
});

describe('fetchAndSaveTickerPrices', () => {
  it('fetches a single ticker when provided', async () => {
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

    const result = await fetchAndSaveTickerPrices('AAPL');

    expect(mockedFetchStockPrice).toHaveBeenCalledWith('AAPL');
    expect(result).toHaveLength(1);
    expect(mockedTrackedFind).not.toHaveBeenCalled();
  });

  it('fetches all tracked tickers when none is specified', async () => {
    mockedTrackedFind.mockResolvedValue([{ ticker: 'AAPL' }, { ticker: 'MSFT' }]);
    mockedFetchStockPrice.mockResolvedValue({ close: 1, open: 1, high: 1, low: 1, volume: 1 });
    mockedFindOneAndUpdate.mockResolvedValue({ date: new Date(), ticker: 'AAPL', price: 1 });

    const result = await fetchAndSaveTickerPrices();

    expect(mockedFetchStockPrice).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('skips a ticker when fetchStockPrice returns null', async () => {
    mockedFetchStockPrice.mockResolvedValue(null);

    const result = await fetchAndSaveTickerPrices('AAPL');

    expect(result).toEqual([]);
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('fetchAllTickerHistory', () => {
  it('throws BadRequestError when ticker is missing', async () => {
    await expect(fetchAllTickerHistory('')).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('delegates to fetchAndSaveAllStockHistory', async () => {
    mockedFetchAllHistory.mockResolvedValue(42);
    expect(await fetchAllTickerHistory('AAPL')).toBe(42);
  });
});

describe('deleteTickerPriceRecord', () => {
  it('throws BadRequestError when id is missing', async () => {
    await expect(deleteTickerPriceRecord('')).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('deletes the record and returns the id', async () => {
    mockedFindByIdAndDelete.mockResolvedValue({});
    expect(await deleteTickerPriceRecord('r1')).toBe('r1');
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('r1');
  });
});

describe('fetchAndSaveLatestPrice (legacy)', () => {
  it('does nothing when the price fetch returns null', async () => {
    mockedFetchStockPrice.mockResolvedValue(null);
    await fetchAndSaveLatestPrice('AAPL');
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts the latest price', async () => {
    mockedFetchStockPrice.mockResolvedValue(150);
    await fetchAndSaveLatestPrice('AAPL');
    expect(mockedFindOneAndUpdate).toHaveBeenCalled();
  });
});
