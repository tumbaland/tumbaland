import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, optionalAuth } from './authMiddleware';
import { UserPayload } from '../types/auth';

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
    expect(req.user).toMatchObject({ id: '1', email: 'user@example.com' });
  });

  it('attaches an empty userGroups array when the token has no groups claim', () => {
    const token = jwt.sign(payload, 'test-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(req.userGroups).toEqual([]);
  });

  it('attaches userGroups from the token when present', () => {
    const token = jwt.sign({ ...payload, groups: ['group-1', 'group-2'] }, 'test-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    authenticateToken(req, res, next);

    expect(req.userGroups).toEqual(['group-1', 'group-2']);
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

describe('optionalAuth', () => {
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

  it('attaches the user when the token is valid', () => {
    const req = mockReq({ cookies: { access_token: jwt.sign(payload, 'test-secret') } });

    optionalAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ email: 'user@example.com' });
  });

  it('reads a bearer token too', () => {
    const req = mockReq({ headers: { authorization: `Bearer ${jwt.sign(payload, 'test-secret')}` } });

    optionalAuth(req, mockRes(), next);

    expect(req.user).toMatchObject({ email: 'user@example.com' });
  });

  it('continues anonymously when there is no token', () => {
    const req = mockReq();
    const res = mockRes();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('treats an expired or forged token as no token rather than as a 401', () => {
    // The caller asked for public data. Refusing it because a stale cookie is
    // lying around would break the landing page for exactly the people most
    // likely to have one.
    const req = mockReq({ cookies: { access_token: jwt.sign(payload, 'wrong-secret') } });
    const res = mockRes();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('continues anonymously when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    const req = mockReq({ cookies: { access_token: 'anything' } });
    const res = mockRes();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
