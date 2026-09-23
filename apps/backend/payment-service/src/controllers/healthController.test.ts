import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { healthCheck } from './healthController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('healthCheck', () => {
  it('responds 200 when Mongo is connected', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as never);
    const res = mockRes();
    await healthCheck({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('responds 503 when Mongo is not connected', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 } as never);
    const res = mockRes();
    await healthCheck({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('responds 503 with a generic error body when reading connection state throws', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockRes();
    await healthCheck({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Health check failed' }));
  });
});
