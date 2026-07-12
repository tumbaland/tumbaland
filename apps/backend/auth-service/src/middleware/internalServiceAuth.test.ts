import { Request, Response } from 'express';
import { requireInternalService } from './internalServiceAuth';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireInternalService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, INTERNAL_SERVICE_TOKEN: 'test-internal-token' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('calls next when the token header matches INTERNAL_SERVICE_TOKEN', () => {
    const req = { headers: { 'x-internal-token': 'test-internal-token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireInternalService(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the header is missing', () => {
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireInternalService(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid or missing internal service token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the header does not match', () => {
    const req = { headers: { 'x-internal-token': 'wrong-token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireInternalService(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 500 when INTERNAL_SERVICE_TOKEN is not configured', () => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
    const req = { headers: { 'x-internal-token': 'anything' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireInternalService(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal service authentication not configured' });
    expect(next).not.toHaveBeenCalled();
  });
});
