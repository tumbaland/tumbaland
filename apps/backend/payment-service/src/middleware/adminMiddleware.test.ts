import { Request, Response } from 'express';
import { requireAdmin } from './adminMiddleware';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireAdmin', () => {
  it('rejects with 403 when there is no user', () => {
    const res = mockRes();
    const next = jest.fn();

    requireAdmin({ user: undefined } as unknown as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a non-admin user', () => {
    const res = mockRes();
    const next = jest.fn();

    requireAdmin({ user: { roles: ['member'] } } as unknown as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a user with no roles', () => {
    const res = mockRes();
    const next = jest.fn();

    requireAdmin({ user: { roles: [] } } as unknown as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a user whose roles include "admin"', () => {
    const res = mockRes();
    const next = jest.fn();

    requireAdmin({ user: { roles: ['member', 'admin'] } } as unknown as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
