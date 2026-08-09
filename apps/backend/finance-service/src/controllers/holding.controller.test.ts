import { Request, Response } from 'express';

jest.mock('../services/holding.service', () => ({
  getAllHoldings: jest.fn(),
  createHolding: jest.fn(),
  updateHolding: jest.fn(),
  deleteHolding: jest.fn()
}));

// createHolding tracks its ticker as a side effect, so it goes through the
// same meter. The wrapper runs the write through; the metering itself is
// covered in trackedTickerUsage.test.ts.
jest.mock('../services/trackedTickerUsage', () => ({
  tickerActor: jest.fn(() => ({ email: 'user@example.com', userId: 'user-1', groups: [] })),
  withTickerSlot: jest.fn((_actor, _target, write) => write())
}));

import * as holdingService from '../services/holding.service';
import { withTickerSlot } from '../services/trackedTickerUsage';
import { getHoldings, addHolding, editHolding, removeHolding } from './holding.controller';

const mocked = holdingService as jest.Mocked<typeof holdingService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, userGroups: [], body: {}, params: {}, query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('getHoldings', () => {
  it('fetches personal holdings when no groupId is given', async () => {
    mocked.getAllHoldings.mockResolvedValue([]);
    const res = mockRes();

    await getHoldings(baseReq(), res);

    expect(mocked.getAllHoldings).toHaveBeenCalledWith('user-1', []);
  });

  it('throws ForbiddenError when requesting a group the user is not a member of', async () => {
    const res = mockRes();
    await expect(getHoldings(baseReq({ query: { groupId: 'g1' } }), res)).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('fetches group holdings when the user is a member', async () => {
    mocked.getAllHoldings.mockResolvedValue([]);
    const res = mockRes();

    await getHoldings(baseReq({ query: { groupId: 'g1' }, userGroups: ['g1'] }), res);

    expect(mocked.getAllHoldings).toHaveBeenCalledWith('user-1', ['g1']);
  });
});

describe('addHolding', () => {
  it('creates the holding and returns 201', async () => {
    mocked.createHolding.mockResolvedValue({ _id: 'h1' } as any);
    const res = mockRes();

    await addHolding(baseReq({ body: { ticker: 'AAPL' } }), res);

    expect(mocked.createHolding).toHaveBeenCalledWith({ ticker: 'AAPL' }, 'user-1', []);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('meters the ticker the holding starts tracking', async () => {
    mocked.createHolding.mockResolvedValue({ _id: 'h1' } as any);
    const res = mockRes();

    await addHolding(baseReq({ body: { ticker: 'AAPL', groupId: 'g1' }, userGroups: ['g1'] }), res);

    expect(withTickerSlot).toHaveBeenCalledWith(
      expect.anything(),
      { ticker: 'AAPL', groupId: 'g1' },
      expect.any(Function)
    );
  });
});

describe('editHolding', () => {
  it('returns 404 when the holding does not exist', async () => {
    mocked.updateHolding.mockResolvedValue(null);
    const res = mockRes();

    await editHolding(baseReq({ params: { id: 'h1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the holding', async () => {
    mocked.updateHolding.mockResolvedValue({ _id: 'h1' } as any);
    const res = mockRes();

    await editHolding(baseReq({ params: { id: 'h1' }, body: { quantity: 5 } }), res);

    expect(mocked.updateHolding).toHaveBeenCalledWith('h1', { quantity: 5 }, 'user-1', []);
  });
});

describe('removeHolding', () => {
  it('deletes the holding', async () => {
    mocked.deleteHolding.mockResolvedValue(undefined as any);
    const res = mockRes();

    await removeHolding(baseReq({ params: { id: 'h1' } }), res);

    expect(mocked.deleteHolding).toHaveBeenCalledWith('h1', 'user-1', []);
  });
});
