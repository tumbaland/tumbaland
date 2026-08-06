jest.mock('../models/FxRate', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), find: jest.fn(), findOneAndUpdate: jest.fn() }
}));

jest.mock('./alphaVantage.service', () => ({
  fetchExchangeRate: jest.fn()
}));

import FxRate from '../models/FxRate';
import { fetchExchangeRate } from './alphaVantage.service';
import { BASE_CURRENCY, getRate, getRates, refreshRate } from './fxRate.service';

const mockedFindOne = FxRate.findOne as unknown as jest.Mock;
const mockedFind = FxRate.find as unknown as jest.Mock;
const mockedUpsert = FxRate.findOneAndUpdate as unknown as jest.Mock;
const mockedFetchRate = fetchExchangeRate as jest.Mock;

const sorted = (value: unknown) => ({ sort: jest.fn().mockResolvedValue(value) });

beforeEach(() => jest.clearAllMocks());

describe('BASE_CURRENCY', () => {
  it('is the currency every total is reported in', () => {
    expect(BASE_CURRENCY).toBe('EUR');
  });
});

describe('getRate', () => {
  it('is 1 for a pair with itself, without hitting the database', async () => {
    expect(await getRate('EUR', 'EUR')).toBe(1);
    expect(mockedFindOne).not.toHaveBeenCalled();
  });

  it('returns the most recent stored rate', async () => {
    mockedFindOne.mockReturnValue(sorted({ rate: 0.92 }));

    expect(await getRate('USD', 'EUR')).toBe(0.92);
  });

  it('returns null rather than a made-up rate when the pair is unknown', async () => {
    mockedFindOne.mockReturnValue(sorted(null));

    expect(await getRate('JPY', 'EUR')).toBeNull();
  });

  it('bounds the lookup to rates at or before the requested date', async () => {
    mockedFindOne.mockReturnValue(sorted({ rate: 0.9 }));

    await getRate('USD', 'EUR', new Date('2026-03-15T13:00:00Z'));

    expect(mockedFindOne).toHaveBeenCalledWith({
      base: 'USD',
      quote: 'EUR',
      date: { $lte: new Date('2026-03-15') }
    });
  });
});

describe('getRates', () => {
  it('maps the base currency to 1 and skips it in the query', async () => {
    const rates = await getRates(['EUR', 'EUR'], 'EUR');

    expect(rates.get('EUR')).toBe(1);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('deduplicates and normalises case before querying', async () => {
    mockedFind.mockReturnValue(sorted([]));

    await getRates(['usd', 'USD', 'gbp'], 'EUR');

    expect(mockedFind).toHaveBeenCalledWith({ base: { $in: ['USD', 'GBP'] }, quote: 'EUR' });
  });

  it('keeps the newest row per pair', async () => {
    mockedFind.mockReturnValue(
      sorted([
        { base: 'USD', rate: 0.93 },
        { base: 'USD', rate: 0.88 },
        { base: 'GBP', rate: 1.17 }
      ])
    );

    const rates = await getRates(['USD', 'GBP'], 'EUR');

    expect(rates.get('USD')).toBe(0.93);
    expect(rates.get('GBP')).toBe(1.17);
  });

  it('omits a currency with no stored rate instead of defaulting it to 1', async () => {
    mockedFind.mockReturnValue(sorted([]));

    const rates = await getRates(['JPY'], 'EUR');

    expect(rates.has('JPY')).toBe(false);
  });
});

describe('refreshRate', () => {
  it('is 1 for a pair with itself, without calling the provider', async () => {
    expect(await refreshRate('EUR', 'EUR')).toBe(1);
    expect(mockedFetchRate).not.toHaveBeenCalled();
  });

  it('stores the fetched rate against today at UTC midnight', async () => {
    mockedFetchRate.mockResolvedValue(0.92);
    mockedUpsert.mockResolvedValue({});

    expect(await refreshRate('usd', 'eur')).toBe(0.92);

    const [filter, doc, options] = mockedUpsert.mock.calls[0];
    expect(filter).toMatchObject({ base: 'USD', quote: 'EUR' });
    expect(filter.date.toISOString()).toBe(filter.date.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    expect(doc).toMatchObject({ rate: 0.92 });
    expect(options).toEqual({ upsert: true, new: true });
  });

  it('leaves the previous rate in place when the provider has nothing', async () => {
    mockedFetchRate.mockResolvedValue(null);

    expect(await refreshRate('USD', 'EUR')).toBeNull();
    expect(mockedUpsert).not.toHaveBeenCalled();
  });
});
