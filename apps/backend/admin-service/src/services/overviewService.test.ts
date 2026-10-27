jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getEntitlements: jest.fn()
}));

import { AdminApiUsage, AdminGroup } from '../models/readModels';
import { activeDay, at, NOW, toolCall, user } from '../test/seed';
import { clearDb, startDb, stopDb } from '../test/mongo';
import { getOverview, MARKET_DATA_DAILY_LIMIT } from './overviewService';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

/**
 * Four people over a month, built so each figure can be checked by hand.
 * Weeks start on Monday; NOW is Tuesday 2026-10-27.
 */
async function seed() {
  const ada = await user('ada@example.com', { createdAt: at('2026-09-28T10:00:00Z') });
  const bob = await user('bob@example.com', { createdAt: at('2026-09-30T10:00:00Z') });
  const cleo = await user('cleo@example.com', { createdAt: at('2026-10-20T10:00:00Z') });
  const dan = await user('dan@example.com', {
    createdAt: at('2026-10-26T09:00:00Z'),
    deletionRequestedAt: at('2026-10-26T10:00:00Z')
  });

  await activeDay(ada.id, '2026-09-28');
  await activeDay(ada.id, '2026-10-05', { modules: { chat: 4 } });
  await activeDay(ada.id, '2026-10-27', { visits: 3, modules: { album: 2, home: 1 } });
  await activeDay(bob.id, '2026-09-30');
  await activeDay(bob.id, '2026-10-12', { backfilled: true });
  await activeDay(cleo.id, '2026-10-20');
  await activeDay(cleo.id, '2026-10-27', { modules: { album: 1 } });
  await activeDay(dan.id, '2026-10-26');
  return { ada, bob, cleo, dan };
}

describe('getOverview', () => {
  it('counts the people who were here, over three windows', async () => {
    await seed();

    const overview = await getOverview({ days: 30, now: NOW });

    expect(overview.active).toEqual({ today: 2, last7: 3, last30: 4 });
    expect(overview.accounts).toEqual({ total: 4, pendingDeletions: 1 });
    expect(overview.range).toEqual({ from: '2026-09-28', to: '2026-10-27' });
  });

  it('gives one entry for every day in the range, quiet ones as zero', async () => {
    await seed();

    const { daily } = await getOverview({ days: 30, now: NOW });

    expect(daily).toHaveLength(30);
    expect(daily[0]).toEqual({ day: '2026-09-28', users: 1, visits: 1 });
    expect(daily.find((entry) => entry.day === '2026-10-01')).toEqual({ day: '2026-10-01', users: 0, visits: 0 });
    expect(daily[29]).toEqual({ day: '2026-10-27', users: 2, visits: 4 });
  });

  it('says when some of the days were filled in from the audit trail', async () => {
    await seed();
    expect((await getOverview({ days: 30, now: NOW })).includesBackfilled).toBe(true);

    // A window that holds only real days.
    expect((await getOverview({ days: 7, now: NOW })).includesBackfilled).toBe(false);
  });

  it('counts signups per week, for the last twelve', async () => {
    await seed();

    const { signups } = await getOverview({ now: NOW });

    expect(signups).toHaveLength(12);
    expect(signups[0].week).toBe('2026-08-10');
    expect(signups.at(-1)).toEqual({ week: '2026-10-26', users: 1 });
    expect(signups.filter((week) => week.users > 0)).toEqual([
      { week: '2026-09-28', users: 2 },
      { week: '2026-10-19', users: 1 },
      { week: '2026-10-26', users: 1 }
    ]);
  });

  it('measures who came back in the weeks after signing up, and leaves unreached weeks empty', async () => {
    await seed();

    const { cohorts } = await getOverview({ now: NOW });

    expect(cohorts).toEqual([
      // ada was back in week 1 and 4, bob in week 2; week 8 has not started.
      { week: '2026-09-28', size: 2, retention: { '1': 1, '2': 1, '4': 1, '8': null } },
      { week: '2026-10-19', size: 1, retention: { '1': 1, '2': null, '4': null, '8': null } },
      { week: '2026-10-26', size: 1, retention: { '1': null, '2': null, '4': null, '8': null } }
    ]);
  });

  it('adds up page opens per week and module', async () => {
    await seed();

    const { opensByWeek } = await getOverview({ now: NOW });

    expect(opensByWeek).toEqual([
      { week: '2026-10-05', modules: { chat: 4 } },
      { week: '2026-10-26', modules: { album: 3, home: 1 } }
    ]);
  });

  it('counts the pairs where both people were here this week', async () => {
    const { ada, bob, cleo, dan } = await seed();
    await AdminGroup.create([
      { name: 'Ada and Bob', createdBy: ada.email, members: [{ email: ada.email, role: 'owner' }, { email: bob.email, role: 'member' }] },
      { name: 'Ada and Cleo', createdBy: ada.email, members: [{ email: ada.email, role: 'owner' }, { email: cleo.email, role: 'member' }] },
      {
        name: 'A trio',
        createdBy: ada.email,
        members: [ada, bob, cleo].map((member) => ({ email: member.email, role: 'member' }))
      },
      {
        name: 'Gone',
        createdBy: cleo.email,
        deletedAt: at('2026-10-01T00:00:00Z'),
        members: [cleo, dan].map((member) => ({ email: member.email, role: 'member' }))
      }
    ]);

    const { pairs } = await getOverview({ now: NOW });

    // bob was last here on the 12th, so only Ada and Cleo are both active.
    expect(pairs).toEqual({ total: 2, bothActiveLast7: 1 });
  });

  it('reports no pairs without asking who was active', async () => {
    expect((await getOverview({ now: NOW })).pairs).toEqual({ total: 0, bothActiveLast7: 0 });
  });

  it('sums this month’s assistant calls and leaves last month out', async () => {
    const { ada } = await seed();
    await toolCall({ userId: ada.id, at: '2026-10-10T10:00:00Z', tokens: 100 });
    await toolCall({ userId: ada.id, at: '2026-10-11T10:00:00Z', tokens: 200 });
    await toolCall({ userId: ada.id, at: '2026-10-12T10:00:00Z', tokens: 50, failed: true });
    await toolCall({ userId: ada.id, at: '2026-09-30T23:59:00Z', tokens: 9999 });

    const { assistants } = await getOverview({ now: NOW });

    expect(assistants).toEqual({ callsThisMonth: 3, tokensThisMonth: 350, failedThisMonth: 1 });
  });

  it('reports the market-data budget used today', async () => {
    await AdminApiUsage.create([
      { provider: 'alphavantage', date: '2026-10-27', count: 7 },
      { provider: 'alphavantage', date: '2026-10-26', count: 25 }
    ]);

    expect((await getOverview({ now: NOW })).marketData).toEqual({
      used: 7,
      limit: MARKET_DATA_DAILY_LIMIT,
      date: '2026-10-27'
    });
  });

  it('is all zeros before anyone has been counted', async () => {
    const overview = await getOverview({ days: 7, now: NOW });

    expect(overview.active).toEqual({ today: 0, last7: 0, last30: 0 });
    expect(overview.daily).toHaveLength(7);
    expect(overview.cohorts).toEqual([]);
    expect(overview.opensByWeek).toEqual([]);
    expect(overview.assistants.callsThisMonth).toBe(0);
    expect(overview.marketData.used).toBe(0);
    expect(overview.includesBackfilled).toBe(false);
  });

  it('defaults to the real clock and thirty days', async () => {
    const overview = await getOverview();

    expect(overview.daily).toHaveLength(30);
    expect(Date.parse(overview.generatedAt)).toBeGreaterThan(Date.now() - 60_000);
  });
});

