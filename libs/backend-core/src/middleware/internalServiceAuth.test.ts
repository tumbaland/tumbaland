import { Request, Response } from 'express';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import {
  allowUserOrInternalService,
  internalServiceTokenBypass,
  requireInternalServiceToken,
  verifyInternalToken
} from './internalServiceAuth';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers, originalUrl: '/internal/entitlements' } as unknown as Request;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, INTERNAL_SERVICE_TOKEN: 'test-internal-token' };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('verifyInternalToken', () => {
  it('accepts only an exact match', () => {
    expect(verifyInternalToken('test-internal-token')).toBe(true);
    expect(verifyInternalToken('test-internal-tokeN')).toBe(false);
  });

  it('rejects a prefix or an extension without throwing on the length mismatch', () => {
    expect(verifyInternalToken('test')).toBe(false);
    expect(verifyInternalToken('test-internal-token-and-more')).toBe(false);
  });

  it('rejects anything that is not a non-empty string', () => {
    expect(verifyInternalToken(undefined)).toBe(false);
    expect(verifyInternalToken('')).toBe(false);
    expect(verifyInternalToken(['test-internal-token'])).toBe(false);
  });

  it('rejects everything when no token is configured', () => {
    delete process.env.INTERNAL_SERVICE_TOKEN;

    expect(verifyInternalToken('test-internal-token')).toBe(false);
  });
});

describe('requireInternalServiceToken', () => {
  it('marks the request internal and continues on a valid token', () => {
    const req = mockReq({ 'x-internal-token': 'test-internal-token', 'x-service-id': 'album-service' });
    const next = jest.fn();

    requireInternalServiceToken(req, mockRes(), next);

    expect(req.isInternalService).toBe(true);
    expect(req.serviceIdentifier).toBe('album-service');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('defaults the service identifier when the header is absent', () => {
    const req = mockReq({ 'x-internal-token': 'test-internal-token' });

    requireInternalServiceToken(req, mockRes(), jest.fn());

    expect(req.serviceIdentifier).toBe('unknown');
  });

  it('rejects a missing token with 401', () => {
    const res = mockRes();
    const next = jest.fn();

    requireInternalServiceToken(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a wrong token with 401', () => {
    const res = mockRes();
    const next = jest.fn();

    requireInternalServiceToken(mockReq({ 'x-internal-token': 'wrong' }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails with 500 rather than open when the deployment has no token configured', () => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
    const res = mockRes();
    const next = jest.fn();

    requireInternalServiceToken(mockReq({ 'x-internal-token': 'anything' }), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('internalServiceTokenBypass', () => {
  it('passes a request with no internal header through untouched, for normal user auth', () => {
    const req = mockReq();
    const next = jest.fn();

    internalServiceTokenBypass(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.isInternalService).toBeUndefined();
  });

  it('rejects a bogus token instead of letting it stand in for authentication', () => {
    // The bug this replaces: the header's mere presence used to skip JWT
    // verification, so `x-internal-token: anything` reached the controller
    // unauthenticated on any route that did not mount a second middleware.
    const res = mockRes();
    const next = jest.fn();

    internalServiceTokenBypass(mockReq({ 'x-internal-token': 'anything' }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('marks a valid internal call and continues', () => {
    const req = mockReq({ 'x-internal-token': 'test-internal-token' });
    const next = jest.fn();

    internalServiceTokenBypass(req, mockRes(), next);

    expect(req.isInternalService).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('allowUserOrInternalService', () => {
  it('allows an internal service', () => {
    const next = jest.fn();

    allowUserOrInternalService({ isInternalService: true } as Request, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows an authenticated user', () => {
    const next = jest.fn();

    allowUserOrInternalService({ user: { email: 'u@example.com' } } as Request, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects anyone else with 401', () => {
    const res = mockRes();
    const next = jest.fn();

    allowUserOrInternalService({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
