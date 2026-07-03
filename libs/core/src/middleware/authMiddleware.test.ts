import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, UserPayload } from './authMiddleware';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { cookies: {}, headers: {}, ...overrides } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('authenticateToken', () => {
  const ORIGINAL_ENV = process.env;
  const next = jest.fn();

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
    next.mockClear();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const payload: UserPayload = { id: '1', email: 'user@example.com', name: 'Test User' };

  it('attaches the decoded user and calls next for a valid cookie token', () => {
    const token = jwt.sign(payload, 'test-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toMatchObject({ id: '1', email: 'user@example.com' });
  });

  it('accepts a Bearer token from the Authorization header', () => {
    const token = jwt.sign(payload, 'test-secret');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when no token is present', () => {
    const req = mockReq();
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Access token required' });
  });

  it('returns 401 for an invalid token', () => {
    const req = mockReq({ cookies: { access_token: 'not-a-real-token' } });
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired token' });
  });

  it('returns 401 for a token signed with a different secret', () => {
    const token = jwt.sign(payload, 'wrong-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
