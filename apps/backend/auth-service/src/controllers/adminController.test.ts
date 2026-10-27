import request from 'supertest';

jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  revokeRefreshTokensForUser: jest.fn(),
  ApiKey: { updateMany: jest.fn() },
  AuditEvent: { create: jest.fn() }
}));

jest.mock('../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn()
  }
}));
jest.mock('../models/Session', () => jest.requireActual('../test/sessionModelMock').sessionModule());

import { ApiKey, AuditEvent, revokeRefreshTokensForUser } from '@tumbaland/backend-core';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { makeSession } from '../test/sessionModelMock';
import app from '../app';
import { generateJWT } from '../services/jwtService';

const ADMIN_ID = 'b'.repeat(24);
const TARGET_ID = 'c'.repeat(24);
const SESSION_ID = 'a'.repeat(24);

const mockedFindOne = User.findOne as unknown as jest.Mock;
const mockedFindById = User.findById as unknown as jest.Mock;
const mockedFindOneAndUpdate = User.findOneAndUpdate as unknown as jest.Mock;
const mockedUpdateOne = User.updateOne as unknown as jest.Mock;
const mockedRevoke = revokeRefreshTokensForUser as unknown as jest.Mock;
const mockedKeys = ApiKey.updateMany as unknown as jest.Mock;
const mockedAudit = AuditEvent.create as unknown as jest.Mock;
const sessions = Session as unknown as Record<'findOne' | 'deleteMany', jest.Mock>;

const cookie = () =>
  `access_token=${generateJWT({ id: ADMIN_ID, sid: SESSION_ID, email: 'admin@example.com', name: 'Admin', roles: ['admin'], tokenVersion: 1 })}`;

const asAdmin = (roles: string[] = ['admin']) =>
  mockedFindOne.mockResolvedValue({ _id: ADMIN_ID, email: 'admin@example.com', tokenVersion: 1, isApproved: true, roles });

const requested = new Date('2026-10-20T10:00:00.000Z');
const target = (overrides: Record<string, unknown> = {}) => ({
  _id: TARGET_ID,
  email: 'ada@example.com',
  deletionRequestedAt: requested,
  deletionConfirmedAt: null,
  ...overrides
});

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  delete process.env.GROUP_API_URL;
});

beforeEach(() => {
  jest.clearAllMocks();
  sessions.findOne.mockResolvedValue(makeSession({ _id: SESSION_ID, userId: ADMIN_ID, lastSeenAt: new Date() }));
  sessions.deleteMany.mockResolvedValue({ deletedCount: 2 });
  asAdmin();
  mockedRevoke.mockResolvedValue(1);
  mockedKeys.mockResolvedValue({ modifiedCount: 3 });
  mockedAudit.mockResolvedValue({});
});

describe.each([
  ['confirm', `/auth/admin/users/${TARGET_ID}/deletion/confirm`],
  ['reopen', `/auth/admin/users/${TARGET_ID}/deletion/reopen`]
])('POST deletion/%s access', (_name, path) => {
  it('needs a session', async () => {
    const res = await request(app).post(path);
    expect(res.status).toBe(401);
  });

  it('is for administrators, read from the database and not the token', async () => {
    // The token below still says admin; the account no longer is.
    asAdmin([]);

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it('answers 404 for an id that is not an account', async () => {
    mockedFindById.mockResolvedValue(null);

    const res = await request(app).post(path.replace(TARGET_ID, 'nope')).set('Cookie', cookie());
    expect(res.status).toBe(404);

    const missing = await request(app).post(path).set('Cookie', cookie());
    expect(missing.status).toBe(404);
  });
});

describe('POST /auth/admin/users/:id/deletion/confirm', () => {
  const path = `/auth/admin/users/${TARGET_ID}/deletion/confirm`;

  it('closes the account: signs it out everywhere, cuts off its apps and keys, and says so in the trail', async () => {
    mockedFindById.mockResolvedValue(target());
    mockedFindOneAndUpdate.mockResolvedValue(
      target({ deletionConfirmedAt: new Date('2026-10-27T09:00:00.000Z'), tokenVersion: 2 })
    );

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: TARGET_ID,
      email: 'ada@example.com',
      sessionsEnded: 2,
      connectionsRevoked: 1,
      keysRevoked: 3
    });

    // Preconditions are in the filter, so a race closes it once; the token version bump kills tokens already issued.
    const [filter, update] = mockedFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: TARGET_ID, deletionRequestedAt: { $ne: null }, deletionConfirmedAt: null });
    expect(update.$set).toMatchObject({ deletionConfirmedBy: ADMIN_ID });
    expect(update.$set.deletionConfirmedAt).toBeInstanceOf(Date);
    expect(update.$inc).toEqual({ tokenVersion: 1 });

    expect(sessions.deleteMany).toHaveBeenCalledWith({ userId: TARGET_ID });
    expect(mockedRevoke).toHaveBeenCalledWith(TARGET_ID);
    expect(mockedKeys).toHaveBeenCalledWith(
      { userId: TARGET_ID, revokedAt: { $exists: false } },
      { $set: { revokedAt: expect.any(Date) } }
    );
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'auth-service',
        resource: 'account',
        resourceId: TARGET_ID,
        actorKind: 'person',
        userId: ADMIN_ID
      })
    );
  });

  it('does not delete anything', async () => {
    mockedFindById.mockResolvedValue(target());
    mockedFindOneAndUpdate.mockResolvedValue(target({ deletionConfirmedAt: new Date() }));

    await request(app).post(path).set('Cookie', cookie());

    expect(mockedUpdateOne).not.toHaveBeenCalled();
  });

  it('refuses an account that has not asked', async () => {
    mockedFindById.mockResolvedValue(target({ deletionRequestedAt: null }));

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
    expect(sessions.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses an account that is already closed', async () => {
    mockedFindById.mockResolvedValue(target({ deletionConfirmedAt: new Date() }));

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already closed/);
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses an administrator closing their own account', async () => {
    mockedFindById.mockResolvedValue(target({ _id: ADMIN_ID }));

    const res = await request(app)
      .post(`/auth/admin/users/${ADMIN_ID}/deletion/confirm`)
      .set('Cookie', cookie());

    expect(res.status).toBe(403);
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('closes nothing when the request was cancelled while the page was open', async () => {
    mockedFindById.mockResolvedValue(target());
    mockedFindOneAndUpdate.mockResolvedValue(null);

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(sessions.deleteMany).not.toHaveBeenCalled();
    expect(mockedRevoke).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('undoes the close when cutting off access fails, so Close can be tried again', async () => {
    mockedFindById.mockResolvedValue(target());
    mockedFindOneAndUpdate.mockResolvedValue(target({ deletionConfirmedAt: new Date() }));
    mockedKeys.mockRejectedValue(new Error('db blip'));
    mockedUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(500);
    const [filter, update] = mockedUpdateOne.mock.calls[0];
    // Only the close this request made, never one someone else made since.
    expect(filter).toEqual({ _id: TARGET_ID, deletionConfirmedAt: expect.any(Date) });
    expect(update).toEqual({ $unset: { deletionConfirmedAt: '', deletionConfirmedBy: '' } });
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it('still closes the account when the trail cannot be written', async () => {
    mockedFindById.mockResolvedValue(target());
    mockedFindOneAndUpdate.mockResolvedValue(target({ deletionConfirmedAt: new Date() }));
    mockedAudit.mockRejectedValue(new Error('db down'));

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(200);
  });
});

describe('POST /auth/admin/users/:id/deletion/reopen', () => {
  const path = `/auth/admin/users/${TARGET_ID}/deletion/reopen`;

  it('opens the account again and clears the request with it', async () => {
    const confirmedAt = new Date('2026-10-27T09:00:00.000Z');
    mockedFindById.mockResolvedValue(target({ deletionConfirmedAt: confirmedAt }));
    mockedUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: TARGET_ID,
      email: 'ada@example.com',
      deletionRequestedAt: null,
      deletionConfirmedAt: null
    });
    expect(mockedUpdateOne).toHaveBeenCalledWith(
      { _id: TARGET_ID },
      { $set: { deletionRequestedAt: null }, $unset: { deletionConfirmedAt: '', deletionConfirmedBy: '' } }
    );
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'account',
        resourceId: TARGET_ID,
        changes: { deletionConfirmedAt: { from: confirmedAt.toISOString(), to: null } }
      })
    );
  });

  it('refuses an account that is not closed', async () => {
    mockedFindById.mockResolvedValue(target());

    const res = await request(app).post(path).set('Cookie', cookie());

    expect(res.status).toBe(409);
    expect(mockedUpdateOne).not.toHaveBeenCalled();
  });
});
