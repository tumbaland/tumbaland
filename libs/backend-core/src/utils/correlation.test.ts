import { Request, Response } from 'express';
import { generateCorrelationId, correlationMiddleware } from './correlation';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('generateCorrelationId', () => {
  it('returns a unique UUID each call', () => {
    const a = generateCorrelationId();
    const b = generateCorrelationId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('correlationMiddleware', () => {
  it('generates a new correlation id when none is provided', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    correlationMiddleware(req, res, next);

    expect((req as any).correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', (req as any).correlationId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses an incoming x-correlation-id header', () => {
    const req = mockReq({ 'x-correlation-id': 'existing-id' });
    const res = mockRes();
    const next = jest.fn();

    correlationMiddleware(req, res, next);

    expect((req as any).correlationId).toBe('existing-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-id');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
