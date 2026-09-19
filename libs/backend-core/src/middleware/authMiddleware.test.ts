import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, optionalAuth } from './authMiddleware';
import { PERSONAL_TENANT } from '../apiKeys/types';
import { mintAccessToken } from '../oauth/tokens';
import { UserPayload } from '../types/auth';
import { overrideSessionCheckForTests } from '../auth/session';

// These tokens carry no session; the session check has its own tests below and in session.test.ts.
beforeEach(() => overrideSessionCheckForTests(async () => true));
afterAll(() => overrideSessionCheckForTests());

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

  it('attaches the decoded user and calls next for a valid cookie token', async () => {
    const token = jwt.sign(payload, 'test-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: '1', email: 'user@example.com' });
  });

  it('attaches an empty userGroups array when the token has no groups claim', async () => {
    const token = jwt.sign(payload, 'test-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    await authenticateToken(req, res, next);

    expect(req.userGroups).toEqual([]);
  });

  it('attaches userGroups from the token when present', async () => {
    const token = jwt.sign({ ...payload, groups: ['group-1', 'group-2'] }, 'test-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    await authenticateToken(req, res, next);

    expect(req.userGroups).toEqual(['group-1', 'group-2']);
  });

  it('accepts a Bearer token from the Authorization header', async () => {
    const token = jwt.sign(payload, 'test-secret');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when no token is present', async () => {
    const req = mockReq();
    const res = mockRes();

    await authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Access token required' });
  });

  it('returns 401 for an invalid token', async () => {
    const req = mockReq({ cookies: { access_token: 'not-a-real-token' } });
    const res = mockRes();

    await authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired token' });
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const token = jwt.sign(payload, 'wrong-secret');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();

    await authenticateToken(req, res, next);

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

  it('attaches the user when the token is valid', async () => {
    const req = mockReq({ cookies: { access_token: jwt.sign(payload, 'test-secret') } });

    await optionalAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ email: 'user@example.com' });
  });

  it('reads a bearer token too', async () => {
    const req = mockReq({ headers: { authorization: `Bearer ${jwt.sign(payload, 'test-secret')}` } });

    await optionalAuth(req, mockRes(), next);

    expect(req.user).toMatchObject({ email: 'user@example.com' });
  });

  it('continues anonymously when there is no token', async () => {
    const req = mockReq();
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('treats an expired or forged token as no token rather than as a 401', async () => {
    // The caller asked for public data. Refusing it because a stale cookie is
    // lying around would break the landing page for exactly the people most
    // likely to have one.
    const req = mockReq({ cookies: { access_token: jwt.sign(payload, 'wrong-secret') } });
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('continues anonymously when JWT_SECRET is not configured', async () => {
    delete process.env.JWT_SECRET;
    const req = mockReq({ cookies: { access_token: 'anything' } });
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('OAuth access tokens are not sessions', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  const accessToken = () =>
    mintAccessToken({
      userId: 'u1',
      email: 'u1@example.com',
      name: 'Tester',
      resource: 'https://mcp.example.com',
      issuer: 'https://auth.example.com',
      scopes: ['relationship:read'],
      tenants: [PERSONAL_TENANT],
      defaultTenant: PERSONAL_TENANT,
      tenantNames: {},
      clientId: 'client-1',
      clientName: 'Claude'
    }).accessToken;

  it('refuses one on a session-only route', async () => {
    const res = mockRes();
    const next = jest.fn();
    const req = mockReq({ headers: { authorization: `Bearer ${accessToken()}` } });

    // It verifies — same secret — so nothing but the type check stands between
    // an assistant and every route that has no scopes to be held to.
    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('treats one as no session at all on an optional-auth route', async () => {
    const next = jest.fn();
    const req = mockReq({ headers: { authorization: `Bearer ${accessToken()}` } });

    await optionalAuth(req, mockRes(), next);

    // The route still answers, in its public form — the same as a stale cookie.
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe('ended sessions', () => {
  const ORIGINAL_ENV = process.env;
  const payload: UserPayload = { id: '1', email: 'user@example.com', name: 'Test User', sid: 'a'.repeat(24) };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
    overrideSessionCheckForTests(async () => false);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('authenticateToken refuses a validly signed token whose session has ended', async () => {
    const req = mockReq({ cookies: { access_token: jwt.sign(payload, 'test-secret') } });
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Session has ended' });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('optionalAuth treats an ended session as no session', async () => {
    const req = mockReq({ cookies: { access_token: jwt.sign(payload, 'test-secret') } });
    const next = jest.fn();

    await optionalAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });
});
