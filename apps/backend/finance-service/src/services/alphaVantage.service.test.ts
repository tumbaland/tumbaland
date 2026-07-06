jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: { findOneAndUpdate: jest.fn() }
}));

import TickerPriceHistory from '../models/TickerPriceHistory';
import {
  fetchStockPrice,
  fetchAndSaveAllStockHistory,
  searchTickers
} from './alphaVantage.service';

const mockedUpsert = TickerPriceHistory.findOneAndUpdate as unknown as jest.Mock;

const mockFetchJson = (body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) => {
  (global.fetch as unknown as jest.Mock).mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body
  });
};

beforeAll(() => {
  process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
});

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('fetchStockPrice', () => {
  it('parses a GLOBAL_QUOTE response', async () => {
    mockFetchJson({
      'Global Quote': {
        '02. open': '10.5',
        '03. high': '11.0',
        '04. low': '10.0',
        '05. price': '10.75',
        '06. volume': '1000',
        '07. latest trading day': '2024-05-01'
      }
    });

    const result = await fetchStockPrice('AAPL');

    expect(result).toEqual({ open: 10.5, high: 11.0, low: 10.0, close: 10.75, volume: 1000, date: '2024-05-01' });
  });

  it('returns null when the API is throttled', async () => {
    mockFetchJson({ Note: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.' });
    expect(await fetchStockPrice('AAPL')).toBeNull();
  });

  it('returns null when the quote is missing a price', async () => {
    mockFetchJson({ 'Global Quote': {} });
    expect(await fetchStockPrice('AAPL')).toBeNull();
  });

  it('throws on a non-OK HTTP response', async () => {
    mockFetchJson({}, { ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(fetchStockPrice('AAPL')).rejects.toThrow('HTTP 503');
  });
});

describe('searchTickers', () => {
  it('maps bestMatches into search results', async () => {
    mockFetchJson({
      bestMatches: [
        {
          '1. symbol': 'IBM',
          '2. name': 'International Business Machines',
          '3. type': 'Equity',
          '4. region': 'United States',
          '8. currency': 'USD',
          '9. matchScore': '1.0000'
        }
      ]
    });

    const result = await searchTickers('IBM');

    expect(result).toEqual([
      { symbol: 'IBM', name: 'International Business Machines', type: 'Equity', region: 'United States', currency: 'USD', matchScore: '1.0000' }
    ]);
  });

  it('returns an empty array when there are no matches', async () => {
    mockFetchJson({});
    expect(await searchTickers('ZZZZ')).toEqual([]);
  });

  it('throws TooManyRequestsError when throttled', async () => {
    mockFetchJson({ Information: 'rate limit' });
    await expect(searchTickers('IBM')).rejects.toMatchObject({ name: 'TooManyRequestsError' });
  });
});

describe('fetchAndSaveAllStockHistory', () => {
  it('upserts each trading day and returns the count saved', async () => {
    mockFetchJson({
      'Time Series (Daily)': {
        '2024-05-01': { '1. open': '10', '2. high': '11', '3. low': '9', '4. close': '10.5', '5. volume': '100' },
        '2024-05-02': { '1. open': '10.5', '2. high': '12', '3. low': '10', '4. close': '11.5', '5. volume': '200' }
      }
    });
    mockedUpsert.mockResolvedValue({});

    const saved = await fetchAndSaveAllStockHistory('AAPL');

    expect(saved).toBe(2);
    expect(mockedUpsert).toHaveBeenCalledTimes(2);
    expect(mockedUpsert).toHaveBeenCalledWith(
      { ticker: 'AAPL', date: new Date('2024-05-01') },
      expect.objectContaining({ ticker: 'AAPL', price: 10.5, open: 10, high: 11, low: 9, volume: 100 }),
      { upsert: true, new: true }
    );
  });

  it('returns 0 when there is no time series', async () => {
    mockFetchJson({});
    expect(await fetchAndSaveAllStockHistory('AAPL')).toBe(0);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('throws TooManyRequestsError when throttled', async () => {
    mockFetchJson({ Note: 'rate limit' });
    await expect(fetchAndSaveAllStockHistory('AAPL')).rejects.toMatchObject({ name: 'TooManyRequestsError' });
  });
});
