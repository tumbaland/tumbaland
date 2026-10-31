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

  it('asks the database once when several requests check the same session at the same moment', async () => {
    let answer: (value: unknown) => void = () => {};
    findOne.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const checks = Promise.all([1, 2, 3, 4].map(() => isCurrentSession({ id: USER_ID, sid: SESSION_ID })));
    answer({ _id: SESSION_ID });

    await expect(checks).resolves.toEqual([true, true, true, true]);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing once it has answered, so a revocation holds from the next request', async () => {
    findOne.mockResolvedValueOnce({ _id: SESSION_ID }).mockResolvedValueOnce(null);

    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).resolves.toBe(true);
    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).resolves.toBe(false);

    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('does not share an answer between two different sessions', async () => {
    findOne.mockResolvedValue({ _id: SESSION_ID });

    await Promise.all([
      isCurrentSession({ id: USER_ID, sid: SESSION_ID }),
      isCurrentSession({ id: USER_ID, sid: 'c'.repeat(24) })
    ]);

    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('lets a failed lookup be tried again rather than remembering the failure', async () => {
    findOne.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ _id: SESSION_ID });

    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).rejects.toThrow('timeout');
    await expect(isCurrentSession({ id: USER_ID, sid: SESSION_ID })).resolves.toBe(true);
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
