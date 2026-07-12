import { Request, Response } from 'express';

jest.mock('../services/trackedTicker.service', () => ({
  getAllTrackedTickers: jest.fn(),
  createTrackedTicker: jest.fn(),
  updateTrackedTicker: jest.fn(),
  deleteTrackedTicker: jest.fn()
}));

jest.mock('../services/alphaVantage.service', () => ({ searchTickers: jest.fn() }));

import * as trackedTickerService from '../services/trackedTicker.service';
import { searchTickers } from '../services/alphaVantage.service';
import {
  searchTrackedTickers,
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker
} from './trackedTicker.controller';

const mocked = trackedTickerService as jest.Mocked<typeof trackedTickerService>;
const mockedSearch = searchTickers as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, userGroups: [], body: {}, params: {}, query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('searchTrackedTickers', () => {
  it('throws BadRequestError when q is missing or too short', async () => {
    const res = mockRes();
    await expect(searchTrackedTickers(baseReq({ query: { q: 'a' } }), res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
    await expect(searchTrackedTickers(baseReq({ query: {} }), res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('searches with the trimmed query', async () => {
    mockedSearch.mockResolvedValue([{ symbol: 'AAPL' }]);
    const res = mockRes();

    await searchTrackedTickers(baseReq({ query: { q: '  AAPL  ' } }), res);

    expect(mockedSearch).toHaveBeenCalledWith('AAPL');
  });
});

describe('getTrackedTickers', () => {
  it('fetches personal tickers by default', async () => {
    mocked.getAllTrackedTickers.mockResolvedValue([]);
    const res = mockRes();

    await getTrackedTickers(baseReq(), res);

    expect(mocked.getAllTrackedTickers).toHaveBeenCalledWith('user-1', []);
  });

  it('throws ForbiddenError for a group the user is not a member of', async () => {
    const res = mockRes();
    await expect(getTrackedTickers(baseReq({ query: { groupId: 'g1' } }), res)).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('fetches group tickers when the user is a member', async () => {
    mocked.getAllTrackedTickers.mockResolvedValue([]);
    const res = mockRes();

    await getTrackedTickers(baseReq({ query: { groupId: 'g1' }, userGroups: ['g1'] }), res);

    expect(mocked.getAllTrackedTickers).toHaveBeenCalledWith('user-1', ['g1']);
  });
});

describe('addTrackedTicker', () => {
  it('creates the tracked ticker and returns 201', async () => {
    mocked.createTrackedTicker.mockResolvedValue({ _id: 't1' } as any);
    const res = mockRes();

    await addTrackedTicker(baseReq({ body: { ticker: 'AAPL' } }), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('editTrackedTicker', () => {
  it('returns 404 when the ticker does not exist', async () => {
    mocked.updateTrackedTicker.mockResolvedValue(null);
    const res = mockRes();

    await editTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the tracked ticker', async () => {
    mocked.updateTrackedTicker.mockResolvedValue({ _id: 't1' } as any);
    const res = mockRes();

    await editTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(mocked.updateTrackedTicker).toHaveBeenCalled();
  });
});

describe('removeTrackedTicker', () => {
  it('deletes the tracked ticker', async () => {
    mocked.deleteTrackedTicker.mockResolvedValue(undefined as any);
    const res = mockRes();

    await removeTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(mocked.deleteTrackedTicker).toHaveBeenCalledWith('t1', 'user-1', []);
  });
});
