import { Request, Response } from 'express';

jest.mock('../services/tickerPriceHistory.service', () => ({
  getTickerPriceHistory: jest.fn(),
  fetchAndSaveTickerPrices: jest.fn(),
  fetchAllTickerHistory: jest.fn(),
  deleteTickerPriceRecord: jest.fn()
}));

jest.mock('../services/apiQuota.service', () => ({
  getRemainingQuota: jest.fn()
}));

// Only the two entitlement lookups are stubbed; everything else (sendSuccess,
// the error classes, the logger) stays real so the controller is exercised as
// it actually runs.
jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  retentionFloor: jest.fn(),
  getGroupOwner: jest.fn()
}));

import { retentionFloor, getGroupOwner } from '@tumbaland/backend-core';
import * as tickerPriceService from '../services/tickerPriceHistory.service';
import * as quotaService from '../services/apiQuota.service';

const mockedRetentionFloor = retentionFloor as jest.Mock;
const mockedGetGroupOwner = getGroupOwner as jest.Mock;
const RETENTION = new Date('2026-05-11T00:00:00.000Z');
import {
  getTickerPriceHistory,
  fetchAndSaveTickerPrices,
  fetchAndSaveAllTickerHistory,
  deleteTickerPriceHistory,
  getQuota
} from './tickerPriceHistory.controller';

const mocked = tickerPriceService as jest.Mocked<typeof tickerPriceService>;
const mockedQuota = quotaService as jest.Mocked<typeof quotaService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

/** A request as authenticateToken leaves it. */
const req = (overrides: Partial<Request> = {}) =>
  ({
    user: { id: 'u1', email: 'caller@example.com' },
    userGroups: [],
    query: {},
    params: {},
    body: {},
    ...overrides
  }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
  mockedRetentionFloor.mockResolvedValue(RETENTION);
  mockedGetGroupOwner.mockResolvedValue(null);
});

describe('getTickerPriceHistory', () => {
  it('passes the caller identity through so the service can scope the read', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([{ _id: 'r1' }] as never);
    const res = mockRes();

    await getTickerPriceHistory(req({ userGroups: ['g1'] } as Partial<Request>), res);

    expect(mocked.getTickerPriceHistory).toHaveBeenCalledWith('u1', ['g1'], expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ _id: 'r1' }] }));
  });

  it('forwards ticker, date range and limit', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([] as never);

    await getTickerPriceHistory(
      req({ query: { ticker: 'AAPL', from: '2026-01-01', to: '2026-06-01', limit: '50' } } as Partial<Request>),
      mockRes()
    );

    expect(mocked.getTickerPriceHistory).toHaveBeenCalledWith('u1', [], {
      ticker: 'AAPL',
      from: new Date('2026-01-01'),
      to: new Date('2026-06-01'),
      limit: 50,
      retentionFrom: RETENTION
    });
  });

  it('leaves the filters undefined when no query is given', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([] as never);

    await getTickerPriceHistory(req(), mockRes());

    expect(mocked.getTickerPriceHistory).toHaveBeenCalledWith('u1', [], {
      ticker: undefined,
      from: undefined,
      to: undefined,
      limit: undefined,
      retentionFrom: RETENTION
    });
  });

  it('rejects an unparseable date', async () => {
    await expect(
      getTickerPriceHistory(req({ query: { from: 'yesterday' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('rejects a non-positive or fractional limit', async () => {
    await expect(
      getTickerPriceHistory(req({ query: { limit: '0' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });

    await expect(
      getTickerPriceHistory(req({ query: { limit: '1.5' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('fetchAndSaveTickerPrices', () => {
  it('fetches and saves prices for a ticker in the caller context', async () => {
    mocked.fetchAndSaveTickerPrices.mockResolvedValue([{ _id: 'r1' }] as never);

    await fetchAndSaveTickerPrices(req({ body: { ticker: 'AAPL' }, userGroups: ['g1'] } as Partial<Request>), mockRes());

    expect(mocked.fetchAndSaveTickerPrices).toHaveBeenCalledWith('AAPL', 'u1', ['g1']);
  });
});

describe('fetchAndSaveAllTickerHistory', () => {
  it('returns the ticker and record count', async () => {
    mocked.fetchAllTickerHistory.mockResolvedValue(42);
    const res = mockRes();

    await fetchAndSaveAllTickerHistory(req({ body: { ticker: 'AAPL' } } as Partial<Request>), res);

    expect(mocked.fetchAllTickerHistory).toHaveBeenCalledWith('AAPL', 'u1', []);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ticker: 'AAPL', recordsCount: 42 } })
    );
  });
});

describe('deleteTickerPriceHistory', () => {
  it('throws BadRequestError when id is missing', async () => {
    await expect(deleteTickerPriceHistory(req(), mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('deletes the record in the caller context', async () => {
    mocked.deleteTickerPriceRecord.mockResolvedValue(undefined as never);

    await deleteTickerPriceHistory(req({ params: { id: 'r1' } } as Partial<Request>), mockRes());

    expect(mocked.deleteTickerPriceRecord).toHaveBeenCalledWith('r1', 'u1', []);
  });
});

describe('getQuota', () => {
  it('returns the remaining provider quota', async () => {
    mockedQuota.getRemainingQuota.mockResolvedValue({
      limit: 25,
      used: 3,
      remaining: 22,
      date: '2026-08-06'
    });
    const res = mockRes();

    await getQuota(req(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { limit: 25, used: 3, remaining: 22, date: '2026-08-06' } })
    );
  });
});

describe('retention subjects', () => {
  it('resolves retention from the caller alone in personal context', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([] as never);

    await getTickerPriceHistory(req(), mockRes());

    expect(mockedRetentionFloor).toHaveBeenCalledWith(['caller@example.com']);
    expect(mockedGetGroupOwner).not.toHaveBeenCalled();
  });

  it('adds the group owners, so a paid group lifts the floor for its members', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([] as never);
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: 'owner@example.com' });

    await getTickerPriceHistory(req({ userGroups: ['g1'] } as Partial<Request>), mockRes());

    expect(mockedRetentionFloor).toHaveBeenCalledWith(['caller@example.com', 'owner@example.com']);
  });

  it('does not bill the same subject twice when the caller owns the group', async () => {
    mocked.getTickerPriceHistory.mockResolvedValue([] as never);
    mockedGetGroupOwner.mockResolvedValue({ ownerEmail: 'caller@example.com' });

    await getTickerPriceHistory(req({ userGroups: ['g1'] } as Partial<Request>), mockRes());

    expect(mockedRetentionFloor).toHaveBeenCalledWith(['caller@example.com']);
  });

  it('still serves the read when a group owner cannot be resolved', async () => {
    // History is a read, and reads are never gated to the point of denial —
    // the floor just degrades to the caller's own plan.
    mocked.getTickerPriceHistory.mockResolvedValue([] as never);
    mockedGetGroupOwner.mockRejectedValue(new Error('group-service unreachable'));

    const res = mockRes();
    await getTickerPriceHistory(req({ userGroups: ['g1'] } as Partial<Request>), res);

    expect(mockedRetentionFloor).toHaveBeenCalledWith(['caller@example.com']);
    expect(res.json).toHaveBeenCalled();
  });
});
