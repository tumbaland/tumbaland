import { Request, Response } from 'express';

jest.mock('../services/health.service', () => ({
  checkHealth: jest.fn(),
  getHealthStatusCode: jest.fn()
}));

import { checkHealth, getHealthStatusCode } from '../services/health.service';
import { healthCheck } from './healthController';

const mockedCheckHealth = checkHealth as jest.Mock;
const mockedGetHealthStatusCode = getHealthStatusCode as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

it('responds with the health payload and its derived status code', () => {
  const health = { status: 'ok' };
  mockedCheckHealth.mockReturnValue(health);
  mockedGetHealthStatusCode.mockReturnValue(200);
  const res = mockRes();

  healthCheck({} as Request, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(health);
});
