jest.mock('../models/TickerPriceHistory', () => ({
  __esModule: true,
  default: { findOneAndUpdate: jest.fn() }
}));

// Quota accounting hits Mongo; the provider parsing under test here is
// independent of it, so it is stubbed out and covered by its own suite.
jest.mock('./apiQuota.service', () => ({
  __esModule: true,
  consumeQuota: jest.fn().mockResolvedValue(undefined),
  releaseQuota: jest.fn().mockResolvedValue(undefined)
}));

import TickerPriceHistory from '../models/TickerPriceHistory';
import {
  fetchStockPrice,
  fetchAndSaveAllStockHistory,
  searchTickers,
  fetchExchangeRate
} from './alphaVantage.service';
import { consumeQuota, releaseQuota } from './apiQuota.service';

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

describe('fetchExchangeRate', () => {
  it('parses a CURRENCY_EXCHANGE_RATE response', async () => {
    mockFetchJson({ 'Realtime Currency Exchange Rate': { '5. Exchange Rate': '0.92150000' } });

    expect(await fetchExchangeRate('USD', 'EUR')).toBeCloseTo(0.9215);
  });

  it('returns null when throttled', async () => {
    mockFetchJson({ Information: 'rate limit' });

    expect(await fetchExchangeRate('USD', 'EUR')).toBeNull();
  });

  it('returns null for a missing or non-positive rate', async () => {
    mockFetchJson({ 'Realtime Currency Exchange Rate': {} });
    expect(await fetchExchangeRate('USD', 'EUR')).toBeNull();

    mockFetchJson({ 'Realtime Currency Exchange Rate': { '5. Exchange Rate': '0' } });
    expect(await fetchExchangeRate('USD', 'EUR')).toBeNull();
  });
});

describe('quota accounting', () => {
  it('reserves one call per provider request', async () => {
    mockFetchJson({ 'Global Quote': { '05. price': '10' } });

    await fetchStockPrice('AAPL');

    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(releaseQuota).not.toHaveBeenCalled();
  });

  it('hands the reservation back when the request never reaches the provider', async () => {
    (global.fetch as unknown as jest.Mock).mockRejectedValue(new Error('ENOTFOUND'));

    await expect(fetchStockPrice('AAPL')).rejects.toThrow('ENOTFOUND');
    expect(releaseQuota).toHaveBeenCalledTimes(1);
  });

  it('keeps the reservation when the provider answered with an error status', async () => {
    mockFetchJson({}, { ok: false, status: 500, statusText: 'Server Error' });

    await expect(fetchStockPrice('AAPL')).rejects.toThrow('HTTP 500');
    expect(releaseQuota).not.toHaveBeenCalled();
  });

  it('does not call the provider at all once quota is exhausted', async () => {
    (consumeQuota as jest.Mock).mockRejectedValue(new Error('quota exhausted'));

    await expect(fetchStockPrice('AAPL')).rejects.toThrow('quota exhausted');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
