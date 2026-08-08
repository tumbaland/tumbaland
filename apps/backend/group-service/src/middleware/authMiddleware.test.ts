const mockCoreAuth = jest.fn();

jest.mock('@tumbaland/backend-core', () => {
  const actual = jest.requireActual('@tumbaland/backend-core');
  return {
    ...actual,
    authenticateToken: (...args: unknown[]) => mockCoreAuth(...args)
  };
});

import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './authMiddleware';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, INTERNAL_SERVICE_TOKEN: 'test-internal-token' };
  mockCoreAuth.mockClear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('group-service authenticateToken', () => {
  it('bypasses the JWT check for a valid internal service token', () => {
    const req = { headers: { 'x-internal-token': 'test-internal-token' } } as unknown as Request;
    const next = jest.fn() as NextFunction;

    authenticateToken(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.isInternalService).toBe(true);
    expect(mockCoreAuth).not.toHaveBeenCalled();
  });

  it('rejects a bogus internal token instead of letting it stand in for a JWT', () => {
    // The header used to bypass the JWT check on presence alone, leaving the
    // real check to a middleware mounted per-router — so any route that missed
    // it was reachable with `x-internal-token: anything`.
    const req = { headers: { 'x-internal-token': 'anything' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockCoreAuth).not.toHaveBeenCalled();
  });

  it('delegates to the shared JWT check when no internal token is present', () => {
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(mockCoreAuth).toHaveBeenCalledTimes(1);
    expect(mockCoreAuth).toHaveBeenCalledWith(req, res, next);
    // The wrapper defers the next() decision to the core check.
    expect(next).not.toHaveBeenCalled();
  });
});
