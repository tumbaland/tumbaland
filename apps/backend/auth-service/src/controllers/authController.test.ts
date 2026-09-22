import request from 'supertest';

jest.mock('../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    // Renewal reads the stored picture; none stored unless a test says so.
    findById: jest.fn(() => ({ select: jest.fn().mockResolvedValue(null) }))
  }
}));

jest.mock('../models/Session', () => jest.requireActual('../test/sessionModelMock').sessionModule());

jest.mock('../services/googleAuthService', () => ({
  verifyGoogleToken: jest.fn()
}));

import { Request, Response } from 'express';
import { User } from '../models/User';
import { Session } from '../models/Session';
import app from '../app';
import { generateJWT, decodeJWT, generateRefreshToken } from '../services/jwtService';
import { verifyGoogleToken } from '../services/googleAuthService';
import { validateToken, verifyAuth, refreshToken, safeRedirectTarget } from './authController';

const mockedFindOne = User.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = User.findOneAndUpdate as unknown as jest.Mock;
const mockedVerifyGoogleToken = verifyGoogleToken as unknown as jest.Mock;
const sessions = Session as unknown as Record<'create' | 'findOne' | 'findOneAndUpdate' | 'find' | 'deleteOne' | 'deleteMany', jest.Mock>;

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
    expect(res.body).toEqual({ success: true });

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const accessTokenCookie = (setCookie as unknown as string[]).find((c) => c.startsWith('access_token='));
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toMatch(/HttpOnly/i);

    // The cookie should carry a brand-new (different) signed token.
    const newToken = accessTokenCookie!.split(';')[0].split('=')[1];
    expect(newToken).not.toBe(token);
  });

  it('signs a token without a groups claim, and never asks group-service', async () => {
    process.env.GROUP_API_URL = 'http://group-service.internal';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    global.fetch = jest.fn();
    const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', groups: ['group-1'], tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: true, roles: ['admin'] });

    const res = await request(app).post('/auth/refresh').set('Cookie', `access_token=${token}`);

    // Membership is asked of group-service by each service when a request
    // arrives, so the token no longer carries a copy that can go stale.
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieToken = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(cookieToken)?.groups).toBeUndefined();
    expect(decodeJWT(cookieToken)?.roles).toEqual(['admin']);
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/groups/mine/ids'), expect.anything());

    delete process.env.GROUP_API_URL;
    delete process.env.INTERNAL_SERVICE_TOKEN;
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

  it('keeps a picture the person uploaded instead of taking Google’s again', async () => {
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'ada@example.com', name: 'Ada', picture: 'google.png' });
    mockedFindOneAndUpdate.mockResolvedValue({
      _id: 'db-user-1',
      email: 'ada@example.com',
      tokenVersion: 1,
      isApproved: true,
      picture: 'https://auth.example/auth/avatars/db-user-1?v=1',
      googlePicture: 'google.png'
    });

    const res = await request(app).post('/auth/validate').send({ idToken: 'good-token' });

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { email: 'ada@example.com' },
      expect.objectContaining({ $set: expect.objectContaining({ googlePicture: 'google.png' }) }),
      { new: true, upsert: true }
    );
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const access = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(access)).toMatchObject({ picture: 'https://auth.example/auth/avatars/db-user-1?v=1' });
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

    // A new session for this device, named in the token.
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'db-user-1', method: 'google', lastSeenAt: expect.any(Date) })
    );
    const sessionId = (await sessions.create.mock.results[0].value)._id.toString();
    const access = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(access)).toMatchObject({ id: 'db-user-1', sid: sessionId });

    // The pre-sessions refresh cookie is cleared, not issued.
    expect(setCookie.find((c) => c.startsWith('refresh_token='))).toMatch(/^refresh_token=;/);
  });

  it('signs in without asking group-service, and puts no groups in the token', async () => {
    process.env.GROUP_API_URL = 'http://group-service.internal';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    global.fetch = jest.fn();
    mockedVerifyGoogleToken.mockResolvedValue({ email: 'ada@example.com', name: 'Ada' });
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 'db-user-1', email: 'ada@example.com', tokenVersion: 1, isApproved: true });

    const res = await request(app).post('/auth/validate').send({ idToken: 'good-token' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieToken = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(cookieToken)?.groups).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();

    delete process.env.GROUP_API_URL;
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });
});

describe('POST /auth/google/callback', () => {
  const googleUser = { email: 'ada@example.com', name: 'Ada Lovelace', nonce: 'nonce-1' };
  const target = 'http://localhost:3000/albums';

  const post = (cookies: string[], body: Record<string, string> = { credential: 'good-token' }) =>
    request(app)
      .post('/auth/google/callback')
      // A real form POST from Google's page, which the CORS allow-list must not block.
      .set('Origin', 'https://accounts.google.com')
      .set('Cookie', cookies)
      .type('form')
      .send(body);

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    delete process.env.GROUP_API_URL;
    delete process.env.COOKIE_DOMAIN;
    process.env.AUTH_FRONT_URL = 'http://localhost:3004';
  });

  afterAll(() => {
    delete process.env.AUTH_FRONT_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 'db-user-1', email: 'ada@example.com', tokenVersion: 1, isApproved: true });
  });

  it('signs the person in and sends them back to where they started', async () => {
    mockedVerifyGoogleToken.mockResolvedValue(googleUser);

    const res = await post(['login_nonce=nonce-1', `login_redirect=${encodeURIComponent(target)}`]);

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(target);
    expect(mockedVerifyGoogleToken).toHaveBeenCalledWith('good-token');
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.find((c) => c.startsWith('access_token='))).toMatch(/HttpOnly/i);
    expect(setCookie.find((c) => c.startsWith('refresh_token='))).toBeDefined();
    // The one-time login cookies are cleared.
    expect(setCookie.find((c) => c.startsWith('login_nonce=;'))).toBeDefined();
    expect(setCookie.find((c) => c.startsWith('login_redirect=;'))).toBeDefined();
  });

  it('refuses a token whose nonce does not match this browser (login CSRF)', async () => {
    mockedVerifyGoogleToken.mockResolvedValue({ ...googleUser, nonce: 'someone-elses' });

    const res = await post(['login_nonce=nonce-1', `login_redirect=${encodeURIComponent(target)}`]);

    expect(res.status).toBe(303);
    const location = new URL(res.headers.location);
    expect(location.origin).toBe('http://localhost:3004');
    expect(location.searchParams.get('error')).toBe('signin_failed');
    expect(location.searchParams.get('redirect_uri')).toBe(target);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    expect(setCookie.find((c) => c.startsWith('access_token='))).toBeUndefined();
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a request with no nonce cookie', async () => {
    mockedVerifyGoogleToken.mockResolvedValue(googleUser);

    const res = await post([`login_redirect=${encodeURIComponent(target)}`]);

    expect(res.status).toBe(303);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('signin_failed');
    expect(mockedVerifyGoogleToken).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('refuses a request with no credential', async () => {
    const res = await post(['login_nonce=nonce-1'], {});

    expect(res.status).toBe(303);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('signin_failed');
  });

  it('sends the person to a failure page rather than a 500 when Google rejects the token', async () => {
    mockedVerifyGoogleToken.mockRejectedValue(new Error('Invalid token'));

    const res = await post(['login_nonce=nonce-1']);

    expect(res.status).toBe(303);
    expect(new URL(res.headers.location).searchParams.get('error')).toBe('signin_failed');
  });

  it('never redirects to another domain', async () => {
    mockedVerifyGoogleToken.mockResolvedValue(googleUser);

    const res = await post(['login_nonce=nonce-1', `login_redirect=${encodeURIComponent('https://evil.example/')}`]);

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('http://localhost:3004');
  });
});

describe('safeRedirectTarget', () => {
  beforeAll(() => {
    process.env.COOKIE_DOMAIN = 'tumbaland.eu';
    process.env.AUTH_FRONT_URL = 'https://auth.tumbaland.eu';
  });

  afterAll(() => {
    delete process.env.COOKIE_DOMAIN;
    delete process.env.AUTH_FRONT_URL;
  });

  it.each([
    ['https://tumbaland.eu/', 'https://tumbaland.eu/'],
    ['https://album.tumbaland.eu/x?y=1', 'https://album.tumbaland.eu/x?y=1'],
    ['http://tumbaland.eu/', 'https://auth.tumbaland.eu'],
    ['https://tumbaland.eu.evil.example/', 'https://auth.tumbaland.eu'],
    ['https://eviltumbaland.eu/', 'https://auth.tumbaland.eu'],
    ['javascript:alert(1)', 'https://auth.tumbaland.eu'],
    ['/relative', 'https://auth.tumbaland.eu'],
    [undefined, 'https://auth.tumbaland.eu']
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirectTarget(input)).toBe(expected);
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
    expect(setCookie.find((c) => c.startsWith('refresh_token='))).toMatch(/refresh_token=;.*Path=\/auth/);
  });

  it('still signs out someone whose access token expired, using the refresh cookie', async () => {
    const refresh = generateRefreshToken({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
    mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: true });

    const res = await request(app).post('/auth/logout').set('Cookie', `refresh_token=${refresh}`);

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.find((c) => c.startsWith('refresh_token='))).toMatch(/refresh_token=;/);
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
      user: { email: 'user@example.com' }
    });
  });

  describe('when the access token has expired', () => {
    const person = { id: '1', email: 'user@example.com', name: 'User', picture: 'pic.png', tokenVersion: 2 };
    const expired = () => {
      const realNow = Date.now;
      Date.now = () => realNow() - 2 * 24 * 60 * 60 * 1000;
      try {
        return generateJWT(person);
      } finally {
        Date.now = realNow;
      }
    };

    it('turns a pre-sessions refresh cookie into a session instead of signing the person out', async () => {
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2, isApproved: true });

      const res = await request(app)
        .get('/auth/verify')
        .set('Cookie', [`access_token=${expired()}`, `refresh_token=${generateRefreshToken(person)}`]);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        authenticated: true,
        user: { id: '1', email: 'user@example.com', name: 'User', picture: 'pic.png', tokenVersion: 2 }
      });
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const access = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
      expect(sessions.findOneAndUpdate).toHaveBeenCalledWith(
        { legacyKey: expect.any(String), userId: '1' },
        { $setOnInsert: expect.objectContaining({ userId: '1', method: 'unknown' }) },
        { upsert: true, returnDocument: 'after' }
      );
      const sessionId = (await sessions.findOneAndUpdate.mock.results[0].value)._id.toString();
      expect(decodeJWT(access)).toMatchObject({ email: 'user@example.com', tokenVersion: 2, sid: sessionId });
      // The refresh cookie has done its job and is cleared.
      expect(setCookie.find((c) => c.startsWith('refresh_token='))).toMatch(/^refresh_token=;/);
    });

    it('works with no access cookie at all, as after the browser drops it', async () => {
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2, isApproved: true });

      const res = await request(app)
        .get('/auth/verify')
        .set('Cookie', `refresh_token=${generateRefreshToken(person)}`);

      expect(res.status).toBe(200);
    });

    it('refuses a refresh token from before the tokens were invalidated', async () => {
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 3, isApproved: true });

      const res = await request(app)
        .get('/auth/verify')
        .set('Cookie', `refresh_token=${generateRefreshToken(person)}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, message: 'Token has been invalidated' });
    });

    it('refuses an unapproved account', async () => {
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2, isApproved: false });

      const res = await request(app)
        .get('/auth/verify')
        .set('Cookie', `refresh_token=${generateRefreshToken(person)}`);

      expect(res.status).toBe(403);
    });

    it('gives the usual 401 when the refresh cookie is not a valid refresh token', async () => {
      const res = await request(app)
        .get('/auth/verify')
        .set('Cookie', [`access_token=${expired()}`, `refresh_token=${generateJWT(person)}`]);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, message: 'Invalid or expired token' });
      expect(mockedFindOne).not.toHaveBeenCalled();
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
