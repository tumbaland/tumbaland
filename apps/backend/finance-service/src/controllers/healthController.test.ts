import { Request, Response } from 'express';

jest.mock('../services/healthService', () => ({
  checkHealth: jest.fn(),
  getHealthStatusCode: jest.fn()
}));

import * as healthService from '../services/healthService';
import { healthCheck } from './healthController';

const mockedCheckHealth = healthService.checkHealth as jest.Mock;
const mockedGetStatusCode = healthService.getHealthStatusCode as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('healthCheck', () => {
  it('responds with the health service result and matching status code', async () => {
    mockedCheckHealth.mockResolvedValue({ status: 'ok' });
    mockedGetStatusCode.mockReturnValue(200);
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('responds 503 with a generic error body when checkHealth throws', async () => {
    mockedCheckHealth.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error: 'Health check failed' }));
  });
});
