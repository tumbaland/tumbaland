import request from 'supertest';

jest.mock('../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
  }
}));

jest.mock('../services/googleAuthService', () => ({
  verifyGoogleToken: jest.fn()
}));

import { Request, Response } from 'express';
import { User } from '../models/User';
import app from '../app';
import { generateJWT, decodeJWT } from '../services/jwtService';
import { verifyGoogleToken } from '../services/googleAuthService';
import { validateToken, verifyAuth, refreshToken } from './authController';

const mockedFindOne = User.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = User.findOneAndUpdate as unknown as jest.Mock;
const mockedVerifyGoogleToken = verifyGoogleToken as unknown as jest.Mock;

describe('POST /auth/refresh', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    // getUserGroups() is a no-op unless both of these are set; leaving them
    // unset keeps this test hermetic (no real network call to group-service).
    delete process.env.GROUP_API_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects without a valid session (no cookie)', async () => {
    const res = await request(app).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
    expect(mockedFindOne).not.toHaveBeenCalled();
  });

  it('rejects a malformed/invalid cookie token', async () => {
    const res = await request(app).post('/auth/refresh').set('Cookie', 'access_token=not-a-jwt');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or expired token' });
  });

  it('rejects a token whose tokenVersion has been invalidated', async () => {
    const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2, isApproved: true });

    const res = await request(app).post('/auth/refresh').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Token has been invalidated' });
  });

  it('rejects an unapproved user', async () => {
    const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: false });

    const res = await request(app).post('/auth/refresh').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'User not approved' });
  });

  it('issues a fresh httpOnly access_token cookie and no token field in the body once authenticated', async () => {
    const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: true });

    const res = await request(app).post('/auth/refresh').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, groups: [] });
    expect(res.body.token).toBeUndefined();

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const accessTokenCookie = (setCookie as unknown as string[]).find((c) => c.startsWith('access_token='));
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toMatch(/HttpOnly/i);

    // The cookie should carry a brand-new (different) signed token.
    const newToken = accessTokenCookie!.split(';')[0].split('=')[1];
    expect(newToken).not.toBe(token);
  });
});

describe('POST /auth/internal/invalidate-tokens', () => {
  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('increments and returns the new tokenVersion for an existing user', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2 });

    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .set('x-internal-token', 'test-internal-token')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'User tokens invalidated successfully',
      newTokenVersion: 2
    });
    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );
  });

  it('returns 404 when the user does not exist', async () => {
    mockedFindOneAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .set('x-internal-token', 'test-internal-token')
      .send({ email: 'missing@example.com' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NotFoundError', message: 'User not found' });
  });

  it('demonstrates the end-to-end invalidation contract: a token minted before invalidation is rejected after it', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    const staleToken = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });

    // Step 1: invalidate — DB tokenVersion goes from 1 to 2.
    mockedFindOneAndUpdate.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2 });
    const invalidateRes = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .set('x-internal-token', 'test-internal-token')
      .send({ email: 'user@example.com' });
    expect(invalidateRes.status).toBe(200);

    // Step 2: the token issued before invalidation (tokenVersion: 1) is now
    // rejected because authenticateToken compares it against the DB's
    // current tokenVersion (2).
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2, isApproved: true });
    const refreshRes = await request(app).post('/auth/refresh').set('Cookie', `access_token=${staleToken}`);

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body).toEqual({ success: false, message: 'Token has been invalidated' });
  });
});

describe('POST /auth/validate', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    delete process.env.GROUP_API_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid Google idToken with 401', async () => {
    mockedVerifyGoogleToken.mockResolvedValue(null);

    const res = await request(app).post('/auth/validate').send({ idToken: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid Google token' });
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a Google payload with no email with 400', async () => {
    mockedVerifyGoogleToken.mockResolvedValue({ name: 'No Email' });

    const res = await request(app).post('/auth/validate').send({ idToken: 'token-no-email' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Email not present in Google token' });
  });

  it('upserts the user, sets an httpOnly access_token cookie, and returns the approval status', async () => {
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'Ada@Example.com', name: 'Ada Lovelace', picture: 'pic.png' });
    mockedFindOneAndUpdate.mockResolvedValue({
      _id: 'db-user-1',
      email: 'ada@example.com',
      tokenVersion: 1,
      isApproved: true
    });

    const res = await request(app).post('/auth/validate').send({ idToken: 'good-token' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      user: { id: 'db-user-1', email: 'Ada@Example.com', name: 'Ada Lovelace' },
      approved: true
    });
    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { email: 'ada@example.com' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ email: 'ada@example.com' }) }),
      { new: true, upsert: true }
    );
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.find((c) => c.startsWith('access_token='))).toMatch(/HttpOnly/i);
  });

  it('fetches groups from group-service and includes them in the minted JWT when configured', async () => {
    process.env.GROUP_API_URL = 'http://group-service.internal';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'ada@example.com', name: 'Ada' });
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 'db-user-1', email: 'ada@example.com', tokenVersion: 1, isApproved: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: ['group-1', 'group-2'] })
    });

    const res = await request(app).post('/auth/validate').send({ idToken: 'good-token' });

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://group-service.internal/api/groups/mine/ids'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-internal-token': 'test-internal-token' }) })
    );
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieToken = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    const decoded = decodeJWT(cookieToken);
    expect(decoded?.groups).toEqual(['group-1', 'group-2']);

    delete process.env.GROUP_API_URL;
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });

  it('leaves groups empty when the group-service fetch fails (non-ok response)', async () => {
    process.env.GROUP_API_URL = 'http://group-service.internal';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'ada@example.com', name: 'Ada' });
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 'db-user-1', email: 'ada@example.com', tokenVersion: 1, isApproved: true });
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const res = await request(app).post('/auth/validate').send({ idToken: 'good-token' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieToken = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(cookieToken)?.groups).toEqual([]);

    delete process.env.GROUP_API_URL;
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });

  it('leaves groups empty and does not throw when the group-service fetch itself rejects', async () => {
    process.env.GROUP_API_URL = 'http://group-service.internal';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'ada@example.com', name: 'Ada' });
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 'db-user-1', email: 'ada@example.com', tokenVersion: 1, isApproved: true });
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const res = await request(app).post('/auth/validate').send({ idToken: 'good-token' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieToken = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(cookieToken)?.groups).toEqual([]);

    delete process.env.GROUP_API_URL;
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });
});

describe('POST /auth/logout', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(401);
  });

  it('clears the access_token cookie and returns success for an authenticated, approved user', async () => {
    const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: true });

    const res = await request(app).post('/auth/logout').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Logged out successfully' });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cleared = setCookie.find((c) => c.startsWith('access_token='));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/access_token=;/);
  });
});

describe('GET /auth/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GROUP_API_URL;
  });

  it('returns the authenticated user and a fresh token for a valid, approved session', async () => {
    const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: true });

    const res = await request(app).get('/auth/verify').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      authenticated: true,
      user: { email: 'user@example.com', groups: [] }
    });
  });
});

// These three cases are unreachable through the real route: authenticateToken
// always guarantees req.user.email (or the DB upsert failing entirely) before
// verifyAuth/refreshToken/validateToken's handler runs. They're still real
// defensive checks in the exported functions, so call them directly.
describe('defensive checks unreachable via the route (called directly)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  });

  function mockRes(): Response {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    return res as Response;
  }

  it('verifyAuth throws UnauthorizedError when req.user has no email', async () => {
    const res = mockRes();
    await expect(verifyAuth({ user: {} } as unknown as Request, res)).rejects.toThrow('No authenticated user');
  });

  it('refreshToken throws UnauthorizedError when req.user has no email', async () => {
    const res = mockRes();
    await expect(refreshToken({ user: {} } as unknown as Request, res)).rejects.toThrow('No authenticated user');
  });

  it('validateToken throws when the DB upsert unexpectedly returns nothing', async () => {
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'ada@example.com', name: 'Ada' });
    mockedFindOneAndUpdate.mockResolvedValue(null);
    const res = mockRes();

    await expect(
      validateToken({ body: { idToken: 'good-token' } } as unknown as Request, res, jest.fn())
    ).rejects.toThrow('Failed to create or find user');
  });
});

describe('admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function adminToken() {
    return generateJWT({ id: '1', email: 'admin@example.com', name: 'Admin', tokenVersion: 1 });
  }

  describe('POST /auth/admin/approve', () => {
    it('rejects a non-admin user with 403', async () => {
      const token = adminToken();
      mockedFindOne.mockResolvedValue({ email: 'admin@example.com', tokenVersion: 1, isApproved: true, roles: [] });

      const res = await request(app)
        .post('/auth/admin/approve')
        .set('Cookie', `access_token=${token}`)
        .send({ email: 'someone@example.com' });

      expect(res.status).toBe(403);
    });

    it('approves the target user for an admin caller', async () => {
      const token = adminToken();
      mockedFindOne.mockResolvedValue({
        email: 'admin@example.com',
        tokenVersion: 1,
        isApproved: true,
        roles: ['admin']
      });
      mockedFindOneAndUpdate.mockResolvedValue({ email: 'someone@example.com', isApproved: true });

      const res = await request(app)
        .post('/auth/admin/approve')
        .set('Cookie', `access_token=${token}`)
        .send({ email: 'someone@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, user: { email: 'someone@example.com', isApproved: true } });
      expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
        { email: 'someone@example.com' },
        { $set: { isApproved: true } },
        { new: true }
      );
    });

    it('returns 404 when the target user does not exist', async () => {
      const token = adminToken();
      mockedFindOne.mockResolvedValue({
        email: 'admin@example.com',
        tokenVersion: 1,
        isApproved: true,
        roles: ['admin']
      });
      mockedFindOneAndUpdate.mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/admin/approve')
        .set('Cookie', `access_token=${token}`)
        .send({ email: 'missing@example.com' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /auth/admin/users', () => {
    it('rejects a non-admin user with 403', async () => {
      const token = adminToken();
      mockedFindOne.mockResolvedValue({ email: 'admin@example.com', tokenVersion: 1, isApproved: true, roles: [] });

      const res = await request(app).get('/auth/admin/users').set('Cookie', `access_token=${token}`);

      expect(res.status).toBe(403);
    });

    it('lists users for an admin caller', async () => {
      const token = adminToken();
      mockedFindOne.mockResolvedValue({
        email: 'admin@example.com',
        tokenVersion: 1,
        isApproved: true,
        roles: ['admin']
      });
      const usersList = [{ email: 'a@example.com' }, { email: 'b@example.com' }];
      const sortMock = jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(usersList) });
      (User as any).find = jest.fn().mockReturnValue({ sort: sortMock });

      const res = await request(app).get('/auth/admin/users').set('Cookie', `access_token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, users: usersList });
    });
  });
});

describe('GET /docs', () => {
  it('redirects to the static API docs index', async () => {
    const res = await request(app).get('/docs');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/api/docs/index.html');
  });
});
