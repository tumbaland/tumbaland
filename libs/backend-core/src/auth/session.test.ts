const connection = { readyState: 1, collection: jest.fn() };

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return { __esModule: true, default: { connection, Types: actual.Types } };
});

import mongoose from 'mongoose';
import {
  USER_SESSIONS_COLLECTION,
  isCurrentSession,
  overrideSessionCheckForTests
} from './session';

const USER_ID = 'b'.repeat(24);
const SESSION_ID = 'a'.repeat(24);
const now = Math.floor(Date.now() / 1000);

describe('isCurrentSession', () => {
  const findOne = jest.fn();

  beforeEach(() => {
    overrideSessionCheckForTests();
    findOne.mockReset();
    connection.readyState = 1;
    connection.collection.mockReset().mockReturnValue({ findOne });
  });

  it('accepts a live session that belongs to the token user', async () => {
    findOne.mockResolvedValue({ _id: SESSION_ID });

    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).resolves.toBe(true);

    expect(mongoose.connection.collection).toHaveBeenCalledWith(USER_SESSIONS_COLLECTION);
    const [query, options] = findOne.mock.calls[0];
    expect(query._id.toString()).toBe(SESSION_ID);
    expect(query.userId.toString()).toBe(USER_ID);
    expect(query.expiresAt.$gt).toBeInstanceOf(Date);
    expect(options).toMatchObject({ readPreference: 'primary' });
  });

  it('refuses a revoked or expired session', async () => {
    findOne.mockResolvedValue(null);

    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).resolves.toBe(false);
  });

  it('refuses while the database is unavailable rather than letting the token through', async () => {
    connection.readyState = 0;

    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each([
    [{ id: USER_ID, sid: 'not-an-id' }],
    [{ id: 'not-an-id', sid: SESSION_ID }],
    [{ id: USER_ID, sid: 42 }],
    [null]
  ])('refuses malformed claims %j without a lookup', async (claims) => {
    await expect(isCurrentSession(claims)).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('refuses a token that names no session, however short-lived', async () => {
    await expect(isCurrentSession({ id: USER_ID, iat: now, exp: now + 60 })).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });
});
