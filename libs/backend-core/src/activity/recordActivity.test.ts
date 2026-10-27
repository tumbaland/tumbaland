/**
 * Against a real MongoDB, like the usage meters: a mocked `$inc` always looks
 * right, and the whole point of this module is that the upsert, the `$min`/`$max`
 * and the dotted counters behave as written when two events race.
 */
import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';
import { UserDay } from './UserDay';
import { dayOf, recordActivity } from './recordActivity';
import { ACTIVITY_MODULES, isActivityModule } from './modules';

jest.setTimeout(120_000);

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await UserDay.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await UserDay.deleteMany({});
});

const at = (iso: string) => new Date(iso);

describe('recordActivity', () => {
  it('creates the day on the first visit', async () => {
    const recorded = await recordActivity({
      userId: 'u1',
      kind: 'visit',
      platform: 'web',
      country: 'EE',
      now: at('2026-10-27T08:00:00Z')
    });

    expect(recorded).toBe(true);
    const day = await UserDay.findOne({ userId: 'u1', day: '2026-10-27' }).lean();
    expect(day).toMatchObject({ visits: 1, platform: { web: 1 }, country: 'EE' });
    expect(day?.firstAt).toEqual(at('2026-10-27T08:00:00Z'));
    expect(day?.lastAt).toEqual(at('2026-10-27T08:00:00Z'));
  });

  it('adds to the same day instead of creating another', async () => {
    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now: at('2026-10-27T08:00:00Z') });
    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'pwa', now: at('2026-10-27T20:00:00Z') });

    expect(await UserDay.countDocuments({ userId: 'u1' })).toBe(1);
    const day = await UserDay.findOne({ userId: 'u1' }).lean();
    expect(day).toMatchObject({ visits: 2, platform: { web: 1, pwa: 1 } });
    expect(day?.firstAt).toEqual(at('2026-10-27T08:00:00Z'));
    expect(day?.lastAt).toEqual(at('2026-10-27T20:00:00Z'));
  });

  it('keeps first and last right when events arrive out of order', async () => {
    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now: at('2026-10-27T20:00:00Z') });
    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now: at('2026-10-27T08:00:00Z') });

    const day = await UserDay.findOne({ userId: 'u1' }).lean();
    expect(day?.firstAt).toEqual(at('2026-10-27T08:00:00Z'));
    expect(day?.lastAt).toEqual(at('2026-10-27T20:00:00Z'));
  });

  it('counts page opens per module without touching visits or the platform split', async () => {
    await recordActivity({ userId: 'u1', kind: 'open', module: 'album', platform: 'web', now: at('2026-10-27T08:00:00Z') });
    await recordActivity({ userId: 'u1', kind: 'open', module: 'album', platform: 'web', now: at('2026-10-27T08:05:00Z') });
    await recordActivity({ userId: 'u1', kind: 'open', module: 'home', platform: 'web', now: at('2026-10-27T08:06:00Z') });

    const day = await UserDay.findOne({ userId: 'u1' }).lean();
    expect(day?.modules).toEqual({ album: 2, home: 1 });
    expect(day?.visits).toBe(0);
    expect(day?.platform ?? {}).toEqual({});
  });

  it('turns a day the backfill guessed into a counted one at the first real visit', async () => {
    await UserDay.create({
      userId: 'u1',
      day: '2026-10-27',
      visits: 1,
      firstAt: at('2026-10-27T07:00:00Z'),
      lastAt: at('2026-10-27T07:00:00Z'),
      backfilled: true
    });

    // A page open alone does not: the guess is about visits.
    await recordActivity({ userId: 'u1', kind: 'open', module: 'album', platform: 'web', now: at('2026-10-27T08:00:00Z') });
    expect((await UserDay.findOne({ userId: 'u1' }).lean())?.backfilled).toBe(true);

    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now: at('2026-10-27T09:00:00Z') });
    const day = await UserDay.findOne({ userId: 'u1' }).lean();
    expect(day?.backfilled).toBeUndefined();
    expect(day?.visits).toBe(2);
  });

  it('keeps people and days apart', async () => {
    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now: at('2026-10-27T23:59:00Z') });
    await recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now: at('2026-10-28T00:01:00Z') });
    await recordActivity({ userId: 'u2', kind: 'visit', platform: 'ios', now: at('2026-10-27T10:00:00Z') });

    expect(await UserDay.countDocuments({})).toBe(3);
  });

  it('survives two events at once', async () => {
    const now = at('2026-10-27T08:00:00Z');
    await Promise.all(
      Array.from({ length: 10 }, () => recordActivity({ userId: 'u1', kind: 'visit', platform: 'web', now }))
    );

    const days = await UserDay.find({ userId: 'u1' }).lean();
    expect(days).toHaveLength(1);
    expect(days[0].visits).toBe(10);
  });

  it('refuses an open without a known module', async () => {
    expect(await recordActivity({ userId: 'u1', kind: 'open', platform: 'web' })).toBe(false);
    expect(
      await recordActivity({ userId: 'u1', kind: 'open', module: 'nope' as never, platform: 'web' })
    ).toBe(false);
    expect(await UserDay.countDocuments({})).toBe(0);
  });

  it('refuses an event with no user', async () => {
    expect(await recordActivity({ userId: '', kind: 'visit', platform: 'web' })).toBe(false);
    expect(await UserDay.countDocuments({})).toBe(0);
  });

  it('never throws when the write fails', async () => {
    const failing = jest.spyOn(UserDay, 'updateOne').mockRejectedValueOnce(new Error('db down'));

    await expect(recordActivity({ userId: 'u1', kind: 'visit', platform: 'web' })).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not record activity',
      expect.objectContaining({ error: 'db down' })
    );
    failing.mockRestore();
  });
});

describe('dayOf', () => {
  it('is the UTC day', () => {
    expect(dayOf(at('2026-10-27T23:59:59Z'))).toBe('2026-10-27');
    expect(dayOf(at('2026-10-28T00:00:00Z'))).toBe('2026-10-28');
  });
});

describe('isActivityModule', () => {
  it('accepts every listed module and nothing else', () => {
    for (const module of ACTIVITY_MODULES) expect(isActivityModule(module)).toBe(true);
    expect(isActivityModule('billing')).toBe(false);
    expect(isActivityModule(undefined)).toBe(false);
    expect(isActivityModule(3)).toBe(false);
  });
});
