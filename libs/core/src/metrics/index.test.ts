import { Request, Response } from 'express';
import {
  activeConnections,
  businessMetrics,
  httpRequestDuration,
  httpRequestsTotal,
  metricsHandler,
  metricsMiddleware,
  register
} from './index';

function mockRes(): Response {
  const res: Partial<Response> & { _finishHandler?: () => void } = {};
  res.set = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.statusCode = 200;
  res.on = jest.fn((event: string, handler: () => void) => {
    if (event === 'finish') res._finishHandler = handler;
    return res as Response;
  });
  return res as Response;
}

describe('metricsHandler', () => {
  it('writes the registry content-type header and the serialized metrics body', async () => {
    const res = mockRes();

    await metricsHandler({} as Request, res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', register.contentType);
    expect(res.end).toHaveBeenCalledWith(expect.any(String));
  });

  it('responds 500 when the registry fails to serialize metrics', async () => {
    const res = mockRes();
    jest.spyOn(register, 'metrics').mockRejectedValueOnce(new Error('boom'));

    await metricsHandler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith('Error generating metrics');
  });
});

describe('metricsMiddleware', () => {
  it('increments active connections immediately and decrements once the response finishes', async () => {
    const req = { method: 'GET', url: '/albums' } as Request;
    const res = mockRes() as Response & { _finishHandler?: () => void };
    const next = jest.fn();
    const before = (await activeConnections.get()).values[0]?.value ?? 0;

    metricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect((await activeConnections.get()).values[0]?.value).toBe(before + 1);

    (res as any)._finishHandler();

    expect((await activeConnections.get()).values[0]?.value).toBe(before);
  });

  it('records request duration and total-count metrics labeled by method/url/status on finish', () => {
    const req = { method: 'POST', url: '/albums' } as Request;
    const res = mockRes();
    res.statusCode = 201;
    const next = jest.fn();

    const durationSpy = jest.spyOn(httpRequestDuration, 'labels');
    const totalSpy = jest.spyOn(httpRequestsTotal, 'labels');

    metricsMiddleware(req, res, next);
    (res as any)._finishHandler();

    expect(durationSpy).toHaveBeenCalledWith('POST', '/albums', '201');
    expect(totalSpy).toHaveBeenCalledWith('POST', '/albums', '201');

    durationSpy.mockRestore();
    totalSpy.mockRestore();
  });
});

describe('businessMetrics', () => {
  it('exposes counters that can be incremented without throwing', () => {
    expect(() => businessMetrics.albumsCreated.inc()).not.toThrow();
    expect(() => businessMetrics.filesUploaded.inc({ file_type: 'image' })).not.toThrow();
    expect(() => businessMetrics.usersRegistered.inc()).not.toThrow();
    expect(() => businessMetrics.paymentsProcessed.inc({ status: 'success', method: 'card' })).not.toThrow();
  });
});
