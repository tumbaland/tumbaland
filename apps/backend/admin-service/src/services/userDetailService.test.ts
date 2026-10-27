jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getEntitlements: jest.fn()
}));

import { Types } from 'mongoose';
import { getEntitlements, resolveLimits, UsageMeter } from '@tumbaland/backend-core';
import { AdminGroup, AdminSession } from '../models/readModels';
import { activeDay, at, FORBIDDEN_FIELDS, keysOf, NOW, toolCall, user, write } from '../test/seed';
import { clearDb, startDb, stopDb } from '../test/mongo';
import { seedCredentials } from '../test/credentials';
import { ASSISTANT_DAYS, getUserDetail, VISIT_DAYS } from './userDetailService';

const mockedEntitlements = getEntitlements as unknown as jest.Mock;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mockedEntitlements.mockImplementation(async (email: string) => ({
    email,
    planCode: email === 'bob@example.com' ? 'support' : 'free',
    status: null,
    limits: resolveLimits(email === 'bob@example.com' ? 'support' : 'free')
  }));
});

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

async function seed() {
  const ada = await user('ada@example.com', { firstName: 'Ada', lastName: 'Lovelace', createdAt: at('2026-07-01T10:00:00Z') });
  const bob = await user('bob@example.com');
  const cleo = await user('cleo@example.com');

  // Visits: one before the 90-day window, then a few inside it.
  await activeDay(ada.id, '2026-07-01');
  await activeDay(ada.id, '2026-10-20', { country: 'EE', platform: { web: 1 }, modules: { album: 2 } });
  await activeDay(ada.id, '2026-10-26', { country: 'EE', platform: { pwa: 1 }, modules: { album: 1, home: 1 } });
  await activeDay(ada.id, '2026-10-27', { visits: 2, country: 'FI', platform: { pwa: 2 }, backfilled: true });

  // What she did herself, with content that must never be shown.
  for (const when of ['2026-10-20T10:00:00Z', '2026-10-21T10:00:00Z', '2026-10-22T10:00:00Z']) {
    await write({ userId: ada.id, at: when, changes: { title: { from: 'secret before', to: 'secret after' } } });
  }
  await write({ userId: ada.id, at: '2026-10-23T10:00:00Z', service: 'relationship-service', resource: 'activity', snapshot: { description: 'a private entry' } });
  await write({ userId: ada.id, at: '2026-10-23T11:00:00Z', service: 'relationship-service', resource: 'activity', action: 'update' });
  // Not hers: an assistant wrote this, and reads are not writes.
  await write({ userId: ada.id, at: '2026-10-24T10:00:00Z', actorKind: 'assistant' });
  await write({ userId: ada.id, at: '2026-10-24T11:00:00Z', action: 'read' });
  // Before the window.
  await write({ userId: ada.id, at: '2026-06-01T10:00:00Z' });

  // Storage: hers is under her email, the pooled group's is under Bob's.
  await UsageMeter.create([
    { subjectId: ada.email, meter: 'storageBytes', period: 'ALL', count: 500 },
    { subjectId: ada.email, meter: 'seats', period: 'ALL', count: 1 },
    { subjectId: bob.email, meter: 'storageBytes', period: 'ALL', count: 9000 }
  ]);
  await AdminGroup.create([
    { name: 'Ada and Bob', createdBy: bob.email, members: [{ email: bob.email, role: 'owner' }, { email: ada.email, role: 'member' }] },
    { name: 'Mine', createdBy: ada.email, members: [{ email: ada.email, role: 'owner' }, { email: cleo.email, role: 'member' }] },
    {
      name: 'Gone',
      createdBy: cleo.email,
      deletedAt: at('2026-10-01T00:00:00Z'),
      members: [{ email: cleo.email, role: 'owner' }, { email: ada.email, role: 'member' }]
    }
  ]);

  await seedCredentials(ada.id);
  await AdminSession.create([
    {
      userId: new Types.ObjectId(ada.id),
      userAgent: IPHONE,
      country: 'EE',
      createdAt: at('2026-10-01T10:00:00Z'),
      lastSeenAt: at('2026-10-27T09:00:00Z'),
      expiresAt: at('2026-11-20T10:00:00Z')
    },
    {
      userId: new Types.ObjectId(ada.id),
      userAgent: 'curl/8',
      createdAt: at('2026-08-01T10:00:00Z'),
      lastSeenAt: at('2026-08-02T09:00:00Z'),
      expiresAt: at('2026-09-01T10:00:00Z')
    }
  ]);

  await toolCall({ userId: ada.id, at: '2026-10-26T10:00:00Z', tool: 'get_day', tokens: 100, ms: 100 });
  await toolCall({ userId: ada.id, at: '2026-10-26T11:00:00Z', tool: 'get_day', tokens: 100, ms: 300, failed: true });
  await toolCall({ userId: ada.id, at: '2026-10-27T10:00:00Z', tool: 'log_day', tokens: 300, ms: 200 });
  await toolCall({ userId: ada.id, at: '2026-08-01T10:00:00Z', tool: 'get_day', tokens: 7777 }); // outside thirty days
  await write({ userId: ada.id, at: '2026-10-25T10:00:00Z', service: 'relationship-service', resource: 'activity', action: 'read', actorKind: 'key' });
  await write({ userId: ada.id, at: '2026-10-25T11:00:00Z', service: 'relationship-service', resource: 'activity', action: 'read', actorKind: 'key' });
  return { ada, bob, cleo };
}

describe('getUserDetail', () => {
  it('names the account and its deletion state', async () => {
    const { ada } = await seed();

    const { user: detail } = await getUserDetail(ada.id, NOW);

    expect(detail).toMatchObject({
      id: ada.id,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      roles: [],
      createdAt: '2026-07-01T10:00:00.000Z',
      deletion: { state: null, requestedAt: null, confirmedAt: null, confirmedBy: null }
    });
  });

  it('shows the days she was here in the window, and counts all of them', async () => {
    const { ada } = await seed();

    const { visits } = await getUserDetail(ada.id, NOW);

    expect(visits.from).toBe('2026-07-30'); // 90 days ending on the 27th
    expect(visits.to).toBe('2026-10-27');
    expect(visits.days.map((day) => day.day)).toEqual(['2026-10-20', '2026-10-26', '2026-10-27']);
    expect(VISIT_DAYS).toBe(90);
    expect(visits.totalActiveDays).toBe(4);
    expect(visits.firstActiveDay).toBe('2026-07-01');
    expect(visits.platforms).toEqual({ web: 1, pwa: 3 });
    expect(visits.countries).toEqual({ EE: 2, FI: 1 });
    expect(visits.days[2]).toMatchObject({ visits: 2, country: 'FI', backfilled: true });
    expect(visits.days[0]).toMatchObject({ backfilled: false, platform: { web: 1 } });
  });

  it('counts what she opened, and what she changed without saying what', async () => {
    const { ada } = await seed();

    const { modules } = await getUserDetail(ada.id, NOW);

    expect(modules.opens).toEqual([
      { module: 'album', opens: 3 },
      { module: 'home', opens: 1 }
    ]);
    expect(modules.writes).toEqual(
      expect.arrayContaining([
        { service: 'album-service', resource: 'photo', action: 'create', count: 3 },
        { service: 'relationship-service', resource: 'activity', action: 'create', count: 1 },
        { service: 'relationship-service', resource: 'activity', action: 'update', count: 1 }
      ])
    );
    // Not the assistant's write, not the read, not the one before the window.
    expect(modules.writes).toHaveLength(3);
  });

  it('reads her quota against her plan, and separates what someone else pays for', async () => {
    const { ada } = await seed();

    const { quota } = await getUserDetail(ada.id, NOW);

    expect(quota.own).toMatchObject({ plan: 'free', stale: false });
    expect(quota.own.meters.find((meter) => meter.meter === 'storageBytes')).toMatchObject({
      used: 500,
      limit: 1024 ** 3,
      period: 'ALL',
      metered: true
    });
    expect(quota.own.meters.find((meter) => meter.meter === 'seats')).toMatchObject({ used: 1, limit: 1 });
    // Nothing increments it, so "0 used" would be a claim nobody can back.
    expect(quota.own.meters.find((meter) => meter.meter === 'aiJobs')).toMatchObject({ metered: false, period: '2026-10' });

    // Bob owns the group she is in; its bytes are his. Her own group and the deleted one are not "pooled".
    expect(quota.pooled).toHaveLength(1);
    expect(quota.pooled[0]).toMatchObject({ billedTo: 'bob@example.com', groups: ['Ada and Bob'] });
    expect(quota.pooled[0].quota).toMatchObject({ plan: 'support' });
    expect(quota.pooled[0].quota.meters.find((meter) => meter.meter === 'storageBytes')?.used).toBe(9000);
  });

  it('lists connected apps, keys and devices without any secret', async () => {
    const { ada } = await seed();

    const { apps } = await getUserDetail(ada.id, NOW);

    expect(apps.connections).toHaveLength(3); // the revoked one is gone
    expect(apps.connections.map((connection) => connection.clientName).sort()).toEqual(['Claude', 'Claude', 'Other Assistant']);
    expect(apps.connections[0]).toMatchObject({ scopes: ['relationship:read'], tenants: ['personal'] });

    expect(apps.keys.map((key) => [key.name, key.state]).sort((a, b) => a[0].localeCompare(b[0]))).toEqual([
      ['expired', 'expired'],
      ['live', 'active'],
      ['revoked', 'revoked']
    ]);

    // The live session only, and as a label rather than the browser's own string.
    expect(apps.devices).toEqual([
      { label: 'Safari on iOS', country: 'EE', createdAt: '2026-10-01T10:00:00.000Z', lastSeenAt: '2026-10-27T09:00:00.000Z' }
    ]);
  });

  it('adds up what assistants did, by app, tool and day', async () => {
    const { ada } = await seed();

    const { assistants } = await getUserDetail(ada.id, NOW);

    expect(assistants.windowDays).toBe(ASSISTANT_DAYS);
    expect(assistants.clients).toEqual([
      {
        credentialId: 'client-claude',
        label: 'Claude',
        kind: 'assistant',
        calls: 3,
        failed: 1,
        tokens: 500,
        avgMs: 200,
        lastAt: '2026-10-27T10:00:00.000Z'
      }
    ]);
    // The costly tool first.
    expect(assistants.tools).toEqual([
      { name: 'log_day', calls: 1, failed: 0, tokens: 300, avgMs: 200 },
      { name: 'get_day', calls: 2, failed: 1, tokens: 200, avgMs: 200 }
    ]);
    expect(assistants.daily).toHaveLength(30);
    expect(assistants.daily.filter((day) => day.calls > 0)).toEqual([
      { day: '2026-10-26', calls: 2, tokens: 200 },
      { day: '2026-10-27', calls: 1, tokens: 300 }
    ]);
    // What keys and assistants did in the services directly: two reads by a key, and the assistant's write.
    expect(assistants.elsewhere).toEqual([
      { service: 'relationship-service', action: 'read', actorKind: 'key', count: 2 },
      { service: 'album-service', action: 'create', actorKind: 'assistant', count: 1 }
    ]);
  });

  it('carries no content and no secret, however deeply it looks', async () => {
    const { ada } = await seed();

    const detail = await getUserDetail(ada.id, NOW);

    const keys = keysOf(detail);
    for (const forbidden of FORBIDDEN_FIELDS) expect(keys.has(forbidden)).toBe(false);
    const text = JSON.stringify(detail);
    expect(text).not.toContain('secret before');
    expect(text).not.toContain('a private entry');
    expect(text).not.toContain('secret-hash');
    expect(text).not.toContain('iPhone');
  });

  it('shows an account that has never been here', async () => {
    const { cleo } = await seed();

    const detail = await getUserDetail(cleo.id, NOW);

    expect(detail.visits).toMatchObject({ days: [], totalActiveDays: 0, firstActiveDay: null });
    expect(detail.modules).toEqual({ opens: [], writes: [] });
    expect(detail.apps).toEqual({ connections: [], keys: [], devices: [] });
    expect(detail.assistants.clients).toEqual([]);
  });

  it('carries a request and its confirmation', async () => {
    const admin = await user('admin@example.com');
    const dan = await user('dan@example.com', {
      deletionRequestedAt: at('2026-10-10T10:00:00Z'),
      deletionConfirmedAt: at('2026-10-12T10:00:00Z'),
      deletionConfirmedBy: admin.id
    });

    expect((await getUserDetail(dan.id, NOW)).user.deletion).toEqual({
      state: 'closed',
      requestedAt: '2026-10-10T10:00:00.000Z',
      confirmedAt: '2026-10-12T10:00:00.000Z',
      confirmedBy: 'admin@example.com'
    });
  });

  it('is not found for an id that is not an account', async () => {
    await expect(getUserDetail('not-an-id', NOW)).rejects.toThrow('User not found');
    await expect(getUserDetail(String(new Types.ObjectId()), NOW)).rejects.toThrow('User not found');
  });

  it('defaults to the real clock', async () => {
    const { ada } = await seed();
    expect((await getUserDetail(ada.id)).visits.to).toBe(new Date().toISOString().slice(0, 10));
  });
});
