import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { healthCheck } from './healthController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

afterEach(() => jest.restoreAllMocks());

describe('healthCheck', () => {
  it('responds 200 with the relationship-service identity and mongodb connected when Mongo is up', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as never);
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        service: 'relationship-service',
        description: 'Social relationship management service',
        dependencies: { mongodb: 'connected' }
      })
    );
  });

  it('responds 503 with mongodb disconnected when Mongo is down', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 } as never);
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', dependencies: { mongodb: 'disconnected' } })
    );
  });
});
