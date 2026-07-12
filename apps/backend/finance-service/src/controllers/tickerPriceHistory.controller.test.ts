import { Request, Response } from 'express';

jest.mock('../services/tickerPriceHistory.service', () => ({
  getTickerPriceHistory: jest.fn(),
  fetchAndSaveTickerPrices: jest.fn(),
  fetchAllTickerHistory: jest.fn(),
  deleteTickerPriceRecord: jest.fn()
}));

import * as tickerPriceService from '../services/tickerPriceHistory.service';
import {
  getTickerPriceHistory,
  fetchAndSaveTickerPrices,
  fetchAndSaveAllTickerHistory,
  deleteTickerPriceHistory
} from './tickerPriceHistory.controller';

const mocked = tickerPriceService as jest.Mocked<typeof tickerPriceService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getTickerPriceHistory', () => {
  it('returns all records', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([{ _id: 'r1' }] as any);
    const res = mockRes();

    await getTickerPriceHistory({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ _id: 'r1' }] }));
  });
});

describe('fetchAndSaveTickerPrices', () => {
  it('fetches and saves prices for a ticker', async () => {
    mocked.fetchAndSaveTickerPrices.mockResolvedValue([{ _id: 'r1' }] as any);
    const res = mockRes();

    await fetchAndSaveTickerPrices({ body: { ticker: 'AAPL' } } as Request, res);

    expect(mocked.fetchAndSaveTickerPrices).toHaveBeenCalledWith('AAPL');
  });
});

describe('fetchAndSaveAllTickerHistory', () => {
  it('returns the ticker and record count', async () => {
    mocked.fetchAllTickerHistory.mockResolvedValue(42);
    const res = mockRes();

    await fetchAndSaveAllTickerHistory({ body: { ticker: 'AAPL' } } as Request, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ticker: 'AAPL', recordsCount: 42 } })
    );
  });
});

describe('deleteTickerPriceHistory', () => {
  it('throws BadRequestError when id is missing', async () => {
    const res = mockRes();
    await expect(deleteTickerPriceHistory({ params: {} } as unknown as Request, res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('deletes the record', async () => {
    mocked.deleteTickerPriceRecord.mockResolvedValue(undefined as any);
    const res = mockRes();

    await deleteTickerPriceHistory({ params: { id: 'r1' } } as unknown as Request, res);

    expect(mocked.deleteTickerPriceRecord).toHaveBeenCalledWith('r1');
  });
});
