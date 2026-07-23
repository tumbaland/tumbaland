import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createHealthCheck } from './createHealthCheck';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('createHealthCheck', () => {
  const config = { service: 'demo-service', description: 'Demo service' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('responds 200 with dependencies.mongodb "connected" when Mongo is up', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as never);
    const res = mockRes();

    await createHealthCheck(config)({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        service: 'demo-service',
        type: 'backend',
        version: '1.0.0',
        description: 'Demo service',
        dependencies: { mongodb: 'connected' }
      })
    );
  });

  it('responds 503 with dependencies.mongodb "disconnected" when Mongo is down', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 } as never);
    const res = mockRes();

    await createHealthCheck(config)({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', dependencies: { mongodb: 'disconnected' } })
    );
  });

  it('honors an explicit version override', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as never);
    const res = mockRes();

    await createHealthCheck({ ...config, version: '2.3.4' })({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ version: '2.3.4' }));
  });

  it('responds 503 with a generic error body when reading connection state throws', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockRes();

    await createHealthCheck(config)({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', service: 'demo-service', error: 'Health check failed' })
    );
  });

  describe('checkDatabase: false (DB-less services)', () => {
    it('always responds 200 ok without touching Mongo or emitting dependencies', async () => {
      const connectionSpy = jest.spyOn(mongoose, 'connection', 'get');
      const res = mockRes();

      await createHealthCheck({ ...config, checkDatabase: false })({} as Request, res);

      expect(connectionSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body).toEqual(
        expect.objectContaining({ status: 'ok', service: 'demo-service', type: 'backend', description: 'Demo service' })
      );
      expect(body).not.toHaveProperty('dependencies');
    });
  });
});
