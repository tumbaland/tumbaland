const mockCoreAuth = jest.fn();

jest.mock('@tumbaland/backend-core', () => ({
  authenticateToken: (...args: unknown[]) => mockCoreAuth(...args)
}));

import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './authMiddleware';

describe('group-service authenticateToken', () => {
  const res = {} as Response;

  it('bypasses the JWT check for internal service calls (x-internal-token)', () => {
    const req = { headers: { 'x-internal-token': 'secret' } } as unknown as Request;
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    // Internal calls are authenticated separately downstream, so this just
    // passes through without invoking the user-JWT check.
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockCoreAuth).not.toHaveBeenCalled();
  });

  it('delegates to the shared JWT check when no internal token is present', () => {
    const req = { headers: {} } as unknown as Request;
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(mockCoreAuth).toHaveBeenCalledTimes(1);
    expect(mockCoreAuth).toHaveBeenCalledWith(req, res, next);
    // The wrapper defers the next() decision to the core check.
    expect(next).not.toHaveBeenCalled();
  });
});
