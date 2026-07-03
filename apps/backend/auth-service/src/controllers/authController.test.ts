import request from 'supertest';

jest.mock('../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
  }
}));

import { User } from '../models/User';
import app from '../app';
import { generateJWT } from '../services/jwtService';

const mockedFindOne = User.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = User.findOneAndUpdate as unknown as jest.Mock;

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
