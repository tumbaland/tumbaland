import { Request, Response } from 'express';

jest.mock('../services/trade.service', () => ({
  getTrades: jest.fn(),
  getPosition: jest.fn(),
  createTrade: jest.fn(),
  updateTrade: jest.fn(),
  deleteTrade: jest.fn()
}));

import * as tradeService from '../services/trade.service';
import { getTrades, getPosition, addTrade, editTrade, removeTrade } from './trade.controller';

const mocked = tradeService as jest.Mocked<typeof tradeService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const req = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'u1' }, userGroups: [], query: {}, params: {}, body: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('getTrades', () => {
  it('reads the caller personal trades when no group is given', async () => {
    mocked.getTrades.mockResolvedValue([] as never);

    await getTrades(req(), mockRes());

    expect(mocked.getTrades).toHaveBeenCalledWith('u1', [], undefined);
  });

  it('passes the group through once membership is confirmed', async () => {
    mocked.getTrades.mockResolvedValue([] as never);

    await getTrades(req({ query: { groupId: 'g1' }, userGroups: ['g1'] } as Partial<Request>), mockRes());

    expect(mocked.getTrades).toHaveBeenCalledWith('u1', ['g1'], undefined);
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      getTrades(req({ query: { groupId: 'g9' }, userGroups: ['g1'] } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('forwards a ticker filter', async () => {
    mocked.getTrades.mockResolvedValue([] as never);

    await getTrades(req({ query: { ticker: 'AAPL' } } as Partial<Request>), mockRes());

    expect(mocked.getTrades).toHaveBeenCalledWith('u1', [], 'AAPL');
  });
});

describe('getPosition', () => {
  it('returns the replayed position alongside the ticker', async () => {
    mocked.getPosition.mockResolvedValue({
      quantity: 10,
      avgBuyPrice: 100,
      costBasis: 1000,
      realizedGain: 50,
      dividends: 5,
      fees: 1,
      netInvested: 946,
      tradeCount: 3
    });
    const res = mockRes();

    await getPosition(req({ params: { ticker: 'aapl' } } as Partial<Request>), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticker: 'AAPL', quantity: 10 }) })
    );
  });
});

describe('addTrade', () => {
  it('creates the trade and answers 201', async () => {
    mocked.createTrade.mockResolvedValue({ _id: 't1' } as never);
    const res = mockRes();

    await addTrade(req({ body: { ticker: 'AAPL' } } as Partial<Request>), res);

    expect(mocked.createTrade).toHaveBeenCalledWith({ ticker: 'AAPL' }, 'u1', []);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('editTrade', () => {
  it('applies the patch to the identified trade', async () => {
    mocked.updateTrade.mockResolvedValue({ _id: 't1' } as never);

    await editTrade(req({ params: { id: 't1' }, body: { quantity: 5 } } as Partial<Request>), mockRes());

    expect(mocked.updateTrade).toHaveBeenCalledWith('t1', { quantity: 5 }, 'u1', []);
  });
});

describe('removeTrade', () => {
  it('deletes the identified trade', async () => {
    mocked.deleteTrade.mockResolvedValue({} as never);

    await removeTrade(req({ params: { id: 't1' } } as Partial<Request>), mockRes());

    expect(mocked.deleteTrade).toHaveBeenCalledWith('t1', 'u1', []);
  });
});
