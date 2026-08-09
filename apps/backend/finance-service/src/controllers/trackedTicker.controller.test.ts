import { Request, Response } from 'express';

jest.mock('../services/trackedTicker.service', () => ({
  getAllTrackedTickers: jest.fn(),
  getTrackedTickerById: jest.fn(),
  createTrackedTicker: jest.fn(),
  updateTrackedTicker: jest.fn(),
  deleteTrackedTicker: jest.fn()
}));

jest.mock('../services/alphaVantage.service', () => ({ searchTickers: jest.fn() }));

// The metering itself is covered in trackedTickerUsage.test.ts; here the
// wrappers run the write through so the controller is exercised end to end,
// and the assertions are about what the controller *tells* them to bill.
jest.mock('../services/trackedTickerUsage', () => ({
  tickerActor: jest.fn(() => ({ email: 'user@example.com', userId: 'user-1', groups: [] })),
  withTickerSlot: jest.fn((_actor, _target, write) => write()),
  withTickerUpdate: jest.fn((_actor, _before, _changes, write) => write()),
  releaseTickerSlot: jest.fn()
}));

import * as trackedTickerService from '../services/trackedTicker.service';
import { searchTickers } from '../services/alphaVantage.service';
import { releaseTickerSlot, withTickerSlot, withTickerUpdate } from '../services/trackedTickerUsage';
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

  it('meters the symbol being added, in the group it is added to', async () => {
    mocked.createTrackedTicker.mockResolvedValue({ _id: 't1' } as any);
    const res = mockRes();

    await addTrackedTicker(baseReq({ body: { ticker: 'AAPL', groupId: 'g1' }, userGroups: ['g1'] }), res);

    expect(withTickerSlot).toHaveBeenCalledWith(
      expect.anything(),
      { ticker: 'AAPL', groupId: 'g1', isActive: undefined },
      expect.any(Function)
    );
  });
});

describe('editTrackedTicker', () => {
  it('returns 404 when the ticker does not exist', async () => {
    mocked.getTrackedTickerById.mockResolvedValue(null as any);
    mocked.updateTrackedTicker.mockResolvedValue(null);
    const res = mockRes();

    await editTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the tracked ticker', async () => {
    mocked.getTrackedTickerById.mockResolvedValue({ _id: 't1', ticker: 'AAPL', isActive: true } as any);
    mocked.updateTrackedTicker.mockResolvedValue({ _id: 't1' } as any);
    const res = mockRes();

    await editTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(mocked.updateTrackedTicker).toHaveBeenCalled();
  });

  it('hands the usage sync the row as it was before the edit', async () => {
    mocked.getTrackedTickerById.mockResolvedValue({
      _id: 't1',
      ticker: 'AAPL',
      groupId: 'g1',
      isActive: true
    } as any);
    mocked.updateTrackedTicker.mockResolvedValue({ _id: 't1' } as any);
    const res = mockRes();

    await editTrackedTicker(baseReq({ params: { id: 't1' }, body: { isActive: false } }), res);

    expect(withTickerUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { id: 't1', ticker: 'AAPL', groupId: 'g1', isActive: true },
      { isActive: false },
      expect.any(Function)
    );
  });
});

describe('removeTrackedTicker', () => {
  it('deletes the tracked ticker', async () => {
    mocked.deleteTrackedTicker.mockResolvedValue(undefined as any);
    const res = mockRes();

    await removeTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(mocked.deleteTrackedTicker).toHaveBeenCalledWith('t1', 'user-1', []);
  });

  it('offers the freed symbol back to the meter', async () => {
    mocked.deleteTrackedTicker.mockResolvedValue({ ticker: 'AAPL', groupId: 'g1', isActive: true } as any);
    const res = mockRes();

    await removeTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(releaseTickerSlot).toHaveBeenCalledWith(expect.anything(), {
      ticker: 'AAPL',
      groupId: 'g1',
      isActive: true
    });
  });

  it('meters nothing when there was no row to delete', async () => {
    mocked.deleteTrackedTicker.mockResolvedValue(null as any);
    const res = mockRes();

    await removeTrackedTicker(baseReq({ params: { id: 't1' } }), res);

    expect(releaseTickerSlot).not.toHaveBeenCalled();
  });
});
