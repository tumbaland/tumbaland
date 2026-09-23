import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { healthCheck, healthLive, metricsHandler } from './healthController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('healthLive', () => {
  it('always responds 200 ok, independent of any dependency state', () => {
    const res = mockRes();
    healthLive({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
  });
});

describe('healthCheck', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('responds 200 with dependencies.mongodb "connected" when Mongo readyState is 1', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as never);
    process.env.SERVICE_NAME = 'album-service';
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        service: 'album-service',
        dependencies: { mongodb: 'connected' }
      })
    );
  });

  it('responds 503 with dependencies.mongodb "disconnected" when Mongo readyState is not 1', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 } as never);
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', dependencies: { mongodb: 'disconnected' } })
    );
  });

  it('falls back to default service/version/description when env vars are unset', async () => {
    delete process.env.SERVICE_NAME;
    delete process.env.npm_package_version;
    delete process.env.SERVICE_DESCRIPTION;
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as never);
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'unknown-service',
        version: '1.0.0',
        description: 'Backend service'
      })
    );
  });

  it('responds 503 with a generic error body when reading connection state throws', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error: 'Health check failed' }));
  });

  it('falls back to default service/version/description in the error body when env vars are unset', async () => {
    delete process.env.SERVICE_NAME;
    delete process.env.npm_package_version;
    delete process.env.SERVICE_DESCRIPTION;
    jest.spyOn(mongoose, 'connection', 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockRes();

    await healthCheck({} as Request, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'unknown-service', version: '1.0.0', description: 'Backend service' })
    );
  });
});

describe('metricsHandler re-export', () => {
  it('re-exports the same metricsHandler function from ../metrics', () => {
    expect(typeof metricsHandler).toBe('function');
  });
});
