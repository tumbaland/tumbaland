jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getEntitlements: jest.fn()
}));

import { getEntitlements, resolveLimits } from '@tumbaland/backend-core';
import { activeDay, at, NOW, toolCall, user } from '../test/seed';
import { clearDb, startDb, stopDb } from '../test/mongo';
import { seedCredentials } from '../test/credentials';
import { deletionStateOf, displayName, listUsers } from './usersService';
import { UsageMeter } from '@tumbaland/backend-core';

const mockedEntitlements = getEntitlements as unknown as jest.Mock;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mockedEntitlements.mockImplementation(async (email: string) => ({
    email,
    planCode: email === 'ada@example.com' ? 'support' : 'free',
    status: null,
    limits: resolveLimits(email === 'ada@example.com' ? 'support' : 'free')
  }));
});

async function seed() {
  const ada = await user('ada@example.com', {
    firstName: 'Ada',
    lastName: 'Lovelace',
    roles: ['admin'],
    createdAt: at('2026-09-01T10:00:00Z'),
    lastLoginAt: at('2026-10-27T08:00:00Z')
  });
  const bob = await user('bob@example.com', { createdAt: at('2026-09-30T10:00:00Z'), googleName: 'Bob G' });
  const cleo = await user('cleo@example.com', { createdAt: at('2026-07-01T10:00:00Z') });
  const dan = await user('dan@example.com', {
    createdAt: at('2026-10-02T10:00:00Z'),
    deletionRequestedAt: at('2026-10-20T10:00:00Z')
  });
  const eve = await user('eve@example.com', {
    createdAt: at('2026-10-03T10:00:00Z'),
    deletionRequestedAt: at('2026-10-10T10:00:00Z'),
    deletionConfirmedAt: at('2026-10-12T10:00:00Z')
  });

  await activeDay(ada.id, '2026-10-27', { visits: 3, modules: { album: 2, home: 1 } });
  await activeDay(ada.id, '2026-10-26', { modules: { album: 1, chat: 1 } });
  await activeDay(ada.id, '2026-10-20');
  // Older than thirty days: seen, but not active this month.
  await activeDay(cleo.id, '2026-08-15', { modules: { finance: 5 } });

  await UsageMeter.create({ subjectId: ada.email, meter: 'storageBytes', period: 'ALL', count: 500 });
  await seedCredentials(ada.id);

  await toolCall({ userId: ada.id, at: '2026-10-20T10:00:00Z' });
  await toolCall({ userId: ada.id, at: '2026-10-26T10:00:00Z' });
  await toolCall({ userId: ada.id, at: '2026-09-01T10:00:00Z' }); // outside thirty days
  return { ada, bob, cleo, dan, eve };
}

describe('listUsers', () => {
  it('describes each account from what it has done', async () => {
    const { ada } = await seed();

    const { users } = await listUsers({ now: NOW });
    const row = users.find((candidate) => candidate.id === ada.id)!;

    expect(row).toMatchObject({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      lastLoginAt: '2026-10-27T08:00:00.000Z',
      lastVisitAt: '2026-10-27T09:00:00.000Z',
      activeDays7: 2,
      activeDays30: 3,
      visits30: 5,
      plan: { code: 'support', stale: false },
      storage: { used: 500, limit: 50 * 1024 ** 3 },
      isAdmin: true,
      deletion: null
    });
    expect(row.topModules).toEqual([
      { module: 'album', opens: 3 },
      { module: 'chat', opens: 1 },
      { module: 'home', opens: 1 }
    ]);
  });

  it('counts live connections, usable keys and recent assistant calls', async () => {
    const { ada } = await seed();

    const row = (await listUsers({ now: NOW })).users.find((candidate) => candidate.id === ada.id)!;

    // Two apps are connected (one of them twice), a third was revoked; one key is live.
    expect(row.connections).toBe(2);
    expect(row.keys).toBe(1);
    expect(row.assistantCalls30).toBe(2);
  });

  it('shows an account that has never been here as such, with the plan it would get', async () => {
    const { bob } = await seed();

    const row = (await listUsers({ now: NOW })).users.find((candidate) => candidate.id === bob.id)!;

    expect(row).toMatchObject({
      name: 'Bob G',
      lastVisitAt: null,
      activeDays7: 0,
      activeDays30: 0,
      visits30: 0,
      topModules: [],
      connections: 0,
      keys: 0,
      assistantCalls30: 0,
      plan: { code: 'free', stale: false },
      storage: { used: 0, limit: 1024 ** 3 }
    });
  });

  it('marks accounts that asked to be deleted, and ones that were closed', async () => {
    await seed();

    const { users } = await listUsers({ now: NOW });
    const state = Object.fromEntries(users.map((row) => [row.email, row.deletion]));

    expect(state).toMatchObject({ 'dan@example.com': 'requested', 'eve@example.com': 'closed', 'ada@example.com': null });
  });

  it('passes on that the plan is a guess when payment-service could not be asked', async () => {
    await seed();
    mockedEntitlements.mockImplementation(async (email: string) => ({
      email,
      planCode: 'free',
      status: null,
      limits: resolveLimits('free'),
      stale: true
    }));

    const { users } = await listUsers({ now: NOW });

    expect(users.every((row) => row.plan.stale)).toBe(true);
  });

  describe('order', () => {
    it('puts whoever was here last first, and people who never came last', async () => {
      const { ada, cleo } = await seed();

      const { users } = await listUsers({ now: NOW });

      expect(users.slice(0, 2).map((row) => row.id)).toEqual([ada.id, cleo.id]);
      expect(users.slice(2).map((row) => row.email).sort()).toEqual(['bob@example.com', 'dan@example.com', 'eve@example.com']);
    });

    it('keeps people who never came last when the order is reversed', async () => {
      const { ada, cleo } = await seed();

      const { users } = await listUsers({ sort: 'lastVisit', order: 'asc', now: NOW });

      expect(users.slice(0, 2).map((row) => row.id)).toEqual([cleo.id, ada.id]);
    });

    it('orders by newest signup', async () => {
      await seed();

      const { users } = await listUsers({ sort: 'signup', now: NOW });

      expect(users.map((row) => row.email)).toEqual([
        'eve@example.com',
        'dan@example.com',
        'bob@example.com',
        'ada@example.com',
        'cleo@example.com'
      ]);
    });

    it('orders by days active this month', async () => {
      const { ada } = await seed();

      const { users } = await listUsers({ sort: 'activeDays30', now: NOW });

      expect(users[0].id).toBe(ada.id);
    });

    it('orders by visits this month', async () => {
      const { ada } = await seed();

      const { users } = await listUsers({ sort: 'visits30', order: 'desc', now: NOW });

      expect(users[0].id).toBe(ada.id);
    });

    it('orders by email, A to Z unless told otherwise', async () => {
      await seed();

      const { users } = await listUsers({ sort: 'email', now: NOW });

      expect(users.map((row) => row.email)).toEqual([
        'ada@example.com',
        'bob@example.com',
        'cleo@example.com',
        'dan@example.com',
        'eve@example.com'
      ]);
      expect((await listUsers({ sort: 'email', order: 'desc', now: NOW })).users[0].email).toBe('eve@example.com');
    });
  });

  describe('paging and search', () => {
    it('pages the list and stays on the last page when asked for one past it', async () => {
      await seed();

      const first = await listUsers({ sort: 'email', limit: 2, page: 1, now: NOW });
      const beyond = await listUsers({ sort: 'email', limit: 2, page: 9, now: NOW });

      expect(first).toMatchObject({ total: 5, page: 1, totalPages: 3 });
      expect(first.users.map((row) => row.email)).toEqual(['ada@example.com', 'bob@example.com']);
      expect(beyond).toMatchObject({ page: 3, totalPages: 3 });
      expect(beyond.users.map((row) => row.email)).toEqual(['eve@example.com']);
    });

    it('looks the plan up for the page shown and nobody else', async () => {
      await seed();

      await listUsers({ sort: 'email', limit: 2, now: NOW });

      expect(mockedEntitlements).toHaveBeenCalledTimes(2);
    });

    it('never returns more than a hundred a page', async () => {
      await seed();
      expect((await listUsers({ limit: 5000, now: NOW })).users).toHaveLength(5);
    });

    it('finds people by part of an email or a name, in any case', async () => {
      await seed();

      expect((await listUsers({ q: 'LOVE', now: NOW })).users.map((row) => row.email)).toEqual(['ada@example.com']);
      // The narrowed scan still finds what the matched person did.
      expect((await listUsers({ q: 'LOVE', now: NOW })).users[0]).toMatchObject({ activeDays30: 3, visits30: 5 });
      expect((await listUsers({ q: 'bob g', now: NOW })).users.map((row) => row.email)).toEqual(['bob@example.com']);
      expect((await listUsers({ q: 'example.com', now: NOW })).total).toBe(5);
    });

    it('treats what is typed as text, not as a pattern', async () => {
      await seed();

      expect((await listUsers({ q: 'a.a', now: NOW })).total).toBe(0);
      expect((await listUsers({ q: '(', now: NOW })).total).toBe(0);
    });

    it('lists nobody before anybody has signed up', async () => {
      expect(await listUsers({ now: NOW })).toEqual({ users: [], total: 0, page: 1, totalPages: 1 });
    });
  });
});

describe('displayName', () => {
  it('prefers the name they set, then the one Google sent', () => {
    expect(displayName({ firstName: 'Ada', lastName: 'Lovelace', googleName: 'A. L.' })).toBe('Ada Lovelace');
    expect(displayName({ firstName: 'Ada', googleName: 'A. L.' })).toBe('Ada');
    expect(displayName({ googleName: 'A. L.' })).toBe('A. L.');
    expect(displayName({})).toBeNull();
  });
});

describe('deletionStateOf', () => {
  it('reads the three states', () => {
    expect(deletionStateOf({})).toBeNull();
    expect(deletionStateOf({ deletionRequestedAt: new Date() })).toBe('requested');
    expect(deletionStateOf({ deletionRequestedAt: new Date(), deletionConfirmedAt: new Date() })).toBe('closed');
  });
});
