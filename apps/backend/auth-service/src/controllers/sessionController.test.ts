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

import { Types } from 'mongoose';
import { User } from '../models/User';
import { Session } from '../models/Session';
import app from '../app';
import { decodeJWT, generateJWT, generateRefreshToken } from '../services/jwtService';
import { makeSession } from '../test/sessionModelMock';

const mockedFindOne = User.findOne as unknown as jest.Mock;
const mockedUserUpdate = User.findOneAndUpdate as unknown as jest.Mock;
const sessions = Session as unknown as Record<
  'create' | 'findOne' | 'findOneAndUpdate' | 'find' | 'deleteOne' | 'deleteMany',
  jest.Mock
>;

const USER_ID = new Types.ObjectId().toString();
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

/**
 * A session and a token that names it, as a signed-in device holds them. The
 * token was issued `tokenAgeMinutes` ago: past TOKEN_REISSUE_AFTER_MS by
 * default, so /auth/verify signs a new one.
 */
const signedIn = (overrides: Record<string, unknown> = {}, tokenAgeMinutes = 20) => {
  const session = makeSession({ userId: new Types.ObjectId(USER_ID), userAgent: IPHONE, ...overrides });
  sessions.findOne.mockResolvedValue(session);
  const iat = Math.floor(Date.now() / 1000) - tokenAgeMinutes * 60;
  const token = generateJWT(
    { id: USER_ID, email: 'ada@example.com', name: 'Ada', tokenVersion: 1, sid: session._id.toString(), iat } as never,
    session.absoluteExpiresAt as Date
  );
  return { session, cookie: `access_token=${token}` };
};

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  delete process.env.GROUP_API_URL;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedFindOne.mockResolvedValue({ _id: USER_ID, email: 'ada@example.com', tokenVersion: 1, isApproved: true, roles: [] });
  sessions.findOne.mockResolvedValue(null);
  sessions.findOneAndUpdate.mockImplementation(async (_query, update, options) =>
    options?.upsert
      ? { _id: new Types.ObjectId(), ...update.$setOnInsert }
      : { ...(await sessions.findOne.mock.results[0]?.value), ...update.$set }
  );
  sessions.deleteOne.mockResolvedValue({ deletedCount: 1 });
  sessions.deleteMany.mockResolvedValue({ deletedCount: 0 });
});

describe('a session token', () => {
  it('is refused once its session has ended, although its signature is still good', async () => {
    const { cookie } = signedIn();
    sessions.findOne.mockResolvedValue(null);

    const res = await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Session has ended' });
  });

  it('looks the session up by id, owner and expiry', async () => {
    const { session, cookie } = signedIn();

    await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(sessions.findOne).toHaveBeenCalledWith({
      _id: session._id.toString(),
      userId: USER_ID,
      expiresAt: { $gt: expect.any(Date) }
    });
  });

  it('is refused when it names no session, however recently it was signed', async () => {
    const token = generateJWT({ id: USER_ID, email: 'ada@example.com', name: 'Ada', tokenVersion: 1 });

    const res = await request(app).get('/auth/verify').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Session has ended');
  });
});

describe('GET /auth/verify with a session', () => {
  it('renews the session: slides its expiry, records when it was seen and where, and re-signs the token', async () => {
    const { session, cookie } = signedIn();

    const res = await request(app)
      .get('/auth/verify')
      .set('Cookie', cookie)
      .set('User-Agent', IPHONE)
      .set('CF-IPCountry', 'EE');

    expect(res.status).toBe(200);
    expect(sessions.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: session._id, userId: session.userId },
      { $set: { lastSeenAt: expect.any(Date), expiresAt: expect.any(Date), country: 'EE' } },
      { returnDocument: 'after' }
    );
    const { expiresAt } = sessions.findOneAndUpdate.mock.calls[0][1].$set;
    expect(expiresAt.getTime()).toBeLessThanOrEqual((session.absoluteExpiresAt as Date).getTime());
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const access = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(access)).toMatchObject({ sid: session._id.toString() });
  });

  it('answers without a new token or cookie while the token is recent, so parallel calls do not race', async () => {
    const { session, cookie } = signedIn({ lastSeenAt: new Date() }, 2);
    process.env.GROUP_API_URL = 'http://group-service.internal';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    global.fetch = jest.fn();

    const res = await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: USER_ID, email: 'ada@example.com', sid: session._id.toString() });
    expect(res.body.user.iat).toBeUndefined();
    expect(res.body.user.exp).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();

    delete process.env.GROUP_API_URL;
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });

  it('still slides the session while the token is recent', async () => {
    const { cookie } = signedIn({}, 2);

    await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(sessions.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ lastSeenAt: expect.any(Date) }) },
      { returnDocument: 'after' }
    );
  });

  it('still refuses a recent token whose session has ended', async () => {
    const { cookie } = signedIn({}, 2);
    sessions.findOne.mockResolvedValue(null);

    const res = await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(res.status).toBe(401);
  });

  it('does not write when the session was seen in the last few minutes', async () => {
    const { cookie } = signedIn({ lastSeenAt: new Date() });

    const res = await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(res.status).toBe(200);
    expect(sessions.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('ends a session that turns up on a different kind of device, since its cookie was copied', async () => {
    const { session, cookie } = signedIn();

    const res = await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', WINDOWS);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Session has ended');
    expect(sessions.deleteOne).toHaveBeenCalledWith({ _id: session._id });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.find((c) => c.startsWith('access_token='))).toMatch(/^access_token=;/);
  });

  it('does not mistake an iPhone asking for the desktop site for another device', async () => {
    const { cookie } = signedIn();
    const desktopMode =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

    const res = await request(app).get('/auth/verify').set('Cookie', cookie).set('User-Agent', desktopMode);

    expect(res.status).toBe(200);
    expect(sessions.deleteOne).not.toHaveBeenCalled();
  });

  it('gives a pre-sessions login a session, so nobody is signed out by the change', async () => {
    const token = generateRefreshToken({ id: USER_ID, email: 'ada@example.com', name: 'Ada', tokenVersion: 1 });

    const res = await request(app).get('/auth/verify').set('Cookie', `refresh_token=${token}`).set('User-Agent', IPHONE);

    expect(res.status).toBe(200);
    expect(sessions.findOneAndUpdate).toHaveBeenCalledWith(
      { legacyKey: expect.stringMatching(/^[0-9a-f]{64}$/), userId: USER_ID },
      { $setOnInsert: expect.objectContaining({ userId: USER_ID, method: 'unknown', userAgent: IPHONE }) },
      { upsert: true, returnDocument: 'after' }
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('gives the parallel calls an app makes when it opens one session between them, not one each', async () => {
    const token = generateRefreshToken({ id: USER_ID, email: 'ada@example.com', name: 'Ada', tokenVersion: 1 });
    const verify = () => request(app).get('/auth/verify').set('Cookie', `refresh_token=${token}`).set('User-Agent', IPHONE);

    await Promise.all([verify(), verify(), verify()]);

    const keys = sessions.findOneAndUpdate.mock.calls.map(([filter]) => filter.legacyKey);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it('uses the session another call just created when their inserts race', async () => {
    const token = generateRefreshToken({ id: USER_ID, email: 'ada@example.com', name: 'Ada', tokenVersion: 1 });
    const winner = makeSession({ userId: new Types.ObjectId(USER_ID), userAgent: IPHONE, lastSeenAt: new Date() });
    sessions.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    sessions.findOne.mockResolvedValue(winner);

    const res = await request(app).get('/auth/verify').set('Cookie', `refresh_token=${token}`).set('User-Agent', IPHONE);

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const access = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(access)).toMatchObject({ sid: winner._id.toString() });
  });
});

describe('POST /auth/refresh', () => {
  it('always signs a new token, however recent the current one is', async () => {
    const { session, cookie } = signedIn({ lastSeenAt: new Date() }, 1);

    const res = await request(app).post('/auth/refresh').set('Cookie', cookie).set('User-Agent', IPHONE);

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const access = setCookie.find((c) => c.startsWith('access_token='))!.split(';')[0].split('=')[1];
    expect(decodeJWT(access)).toMatchObject({ sid: session._id.toString() });
  });
});

describe('POST /auth/logout', () => {
  it('ends this device’s session, so its token stops working everywhere', async () => {
    const { session, cookie } = signedIn();

    const res = await request(app).post('/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(sessions.deleteOne).toHaveBeenCalledWith({ _id: session._id });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.find((c) => c.startsWith('access_token='))).toMatch(/^access_token=;/);
  });
});

describe('POST /auth/internal/invalidate-tokens', () => {
  it('ends all of the person’s sessions', async () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    mockedUserUpdate.mockResolvedValue({ _id: USER_ID, email: 'ada@example.com', tokenVersion: 2 });

    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .set('x-internal-token', 'test-internal-token')
      .send({ email: 'ada@example.com' });

    expect(res.status).toBe(200);
    expect(sessions.deleteMany).toHaveBeenCalledWith({ userId: USER_ID });
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });
});

describe('GET /auth/sessions', () => {
  it('lists the person’s own live sessions with a device label, marking this one', async () => {
    const { session, cookie } = signedIn({ country: 'EE' });
    const other = makeSession({ userAgent: WINDOWS, method: 'google' });
    sessions.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([session, other]) });

    const res = await request(app).get('/auth/sessions').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(sessions.find).toHaveBeenCalledWith({ userId: USER_ID, expiresAt: { $gt: expect.any(Date) } });
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: session._id.toString(), device: 'Safari on iPhone', country: 'EE', current: true }),
      expect.objectContaining({ id: other._id.toString(), device: 'Chrome on Windows', country: null, current: false })
    ]);
  });

  it('is not open to a token without a live session', async () => {
    const { cookie } = signedIn();
    sessions.findOne.mockResolvedValue(null);

    const res = await request(app).get('/auth/sessions').set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(sessions.find).not.toHaveBeenCalled();
  });
});

describe('DELETE /auth/sessions/:id', () => {
  it('signs out another device, scoped to the person’s own sessions', async () => {
    const { cookie } = signedIn();
    const otherId = new Types.ObjectId().toString();

    const res = await request(app).delete(`/auth/sessions/${otherId}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ signedOut: false });
    expect(sessions.deleteOne).toHaveBeenCalledWith({ _id: otherId, userId: USER_ID });
  });

  it('signs this browser out too when it is the current session', async () => {
    const { session, cookie } = signedIn();

    const res = await request(app).delete(`/auth/sessions/${session._id}`).set('Cookie', cookie);

    expect(res.body.data).toEqual({ signedOut: true });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.find((c) => c.startsWith('access_token='))).toMatch(/^access_token=;/);
  });

  it('answers 404 for a session that is not theirs, or not a session id at all', async () => {
    const { cookie } = signedIn();
    sessions.deleteOne.mockResolvedValue({ deletedCount: 0 });

    const notTheirs = await request(app).delete(`/auth/sessions/${new Types.ObjectId()}`).set('Cookie', cookie);
    const garbage = await request(app).delete('/auth/sessions/not-an-id').set('Cookie', cookie);

    expect(notTheirs.status).toBe(404);
    expect(garbage.status).toBe(404);
  });
});

describe('POST /auth/sessions/revoke-others', () => {
  it('ends every session but this one', async () => {
    const { session, cookie } = signedIn();
    sessions.deleteMany.mockResolvedValue({ deletedCount: 2 });

    const res = await request(app).post('/auth/sessions/revoke-others').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ revoked: 2 });
    expect(sessions.deleteMany).toHaveBeenCalledWith({ userId: USER_ID, _id: { $ne: session._id.toString() } });
  });
});
