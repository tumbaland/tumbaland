import request from 'supertest';
import { mintAccessToken, PERSONAL_TENANT } from '@tumbaland/backend-core';

jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  recordActivity: jest.fn().mockResolvedValue(true)
}));

jest.mock('../models/User', () => ({
  User: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn() }
}));
jest.mock('../models/Session', () => jest.requireActual('../test/sessionModelMock').sessionModule());

import { recordActivity } from '@tumbaland/backend-core';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { makeSession } from '../test/sessionModelMock';
import app from '../app';
import { generateJWT } from '../services/jwtService';
import { postActivity } from './activityController';
import type { Request, Response } from 'express';

const SESSION_ID = 'a'.repeat(24);
const mockedRecord = recordActivity as unknown as jest.Mock;
const mockedFindOne = User.findOne as unknown as jest.Mock;
const sessions = Session as unknown as Record<'findOne', jest.Mock>;

const token = () => generateJWT({ id: 'user-1', sid: SESSION_ID, email: 'ada@example.com', name: 'Ada', tokenVersion: 1 });
const cookie = () => `access_token=${token()}`;

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  delete process.env.GROUP_API_URL;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedRecord.mockResolvedValue(true);
  sessions.findOne.mockResolvedValue(makeSession({ _id: SESSION_ID, lastSeenAt: new Date() }));
  mockedFindOne.mockResolvedValue({ email: 'ada@example.com', tokenVersion: 1, isApproved: true });
});

describe('POST /auth/activity', () => {
  it('needs a session', async () => {
    const res = await request(app).post('/auth/activity').send({ kind: 'visit', platform: 'web' });

    expect(res.status).toBe(401);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('counts a visit for the signed-in person and answers 204', async () => {
    const res = await request(app)
      .post('/auth/activity')
      .set('Cookie', cookie())
      .set('CF-IPCountry', 'EE')
      .send({ kind: 'visit', platform: 'pwa' });

    expect(res.status).toBe(204);
    expect(mockedRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      kind: 'visit',
      module: undefined,
      platform: 'pwa',
      country: 'EE'
    });
  });

  it('counts a page open against its module', async () => {
    const res = await request(app)
      .post('/auth/activity')
      .set('Cookie', cookie())
      .send({ kind: 'open', module: 'album', platform: 'web' });

    expect(res.status).toBe(204);
    expect(mockedRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'open', module: 'album' }));
  });

  it.each([
    ['an open with no module', { kind: 'open', platform: 'web' }],
    ['a module that is not listed', { kind: 'open', module: 'billing', platform: 'web' }],
    ['an unknown kind', { kind: 'click', platform: 'web' }],
    ['an unknown platform', { kind: 'visit', platform: 'toaster' }],
    ['no body', {}]
  ])('rejects %s with 400', async (_name, body) => {
    const res = await request(app).post('/auth/activity').set('Cookie', cookie()).send(body);

    expect(res.status).toBe(400);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('refuses a connected assistant: software opening nothing is not a visit', async () => {
    const accessToken = mintAccessToken({
      userId: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      resource: 'https://mcp.example.com',
      issuer: 'https://auth.example.com',
      scopes: ['relationship:read'],
      tenants: [PERSONAL_TENANT],
      defaultTenant: PERSONAL_TENANT,
      tenantNames: {},
      clientId: 'client-1',
      clientName: 'Test Assistant'
    }).accessToken;

    const res = await request(app)
      .post('/auth/activity')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ kind: 'visit', platform: 'web' });

    expect(res.status).toBe(403);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('refuses a request that somehow has no user (called directly)', async () => {
    await expect(postActivity({ user: undefined, body: {} } as unknown as Request, {} as Response)).rejects.toThrow(
      'Not authenticated'
    );
  });
});
