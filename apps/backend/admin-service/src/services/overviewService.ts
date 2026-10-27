import { AuditEvent, UserDay } from '@tumbaland/backend-core';
import { AdminApiUsage, AdminGroup, AdminUser } from '../models/readModels';
import { daysBetween, monthStart, shiftDay, startOfDay, toDay, weekStart, weeksBetween } from './dates';

/**
 * finance-service's daily budget for the market-data provider, which is its
 * `DAILY_LIMIT` (apiQuota.service.ts). Repeated here because that file is in
 * another service; if the limit there changes, this changes with it.
 */
export const MARKET_DATA_PROVIDER = 'alphavantage';
export const MARKET_DATA_DAILY_LIMIT = 25;

/** Weeks after signup that retention is reported at. */
export const RETENTION_WEEKS = [1, 2, 4, 8] as const;

const SIGNUP_WEEKS = 12;
const COHORT_WEEKS = 8;

export interface Overview {
  generatedAt: string;
  /** The days the daily series covers. */
  range: { from: string; to: string };
  accounts: { total: number; pendingDeletions: number };
  /** People who opened the app (distinct) today, in the last 7 days and in the last 30. */
  active: { today: number; last7: number; last30: number };
  /** One entry for every day in the range, zeros included. */
  daily: Array<{ day: string; users: number; visits: number }>;
  /** Some of the days in the range were filled from the audit trail and undercount. */
  includesBackfilled: boolean;
  signups: Array<{ week: string; users: number }>;
  /** Of the people who signed up in a week, how many came back in week 1, 2, 4 and 8 after it. */
  cohorts: Array<{ week: string; size: number; retention: Record<string, number | null> }>;
  /** Page opens per week, by module key. */
  opensByWeek: Array<{ week: string; modules: Record<string, number> }>;
  pairs: { total: number; bothActiveLast7: number };
  assistants: { callsThisMonth: number; tokensThisMonth: number; failedThisMonth: number };
  marketData: { used: number; limit: number; date: string };
}

const activeSince = async (day: string): Promise<string[]> => UserDay.distinct('userId', { day: { $gte: day } });

async function dailyActivity(from: string, to: string): Promise<Overview['daily']> {
  const rows = await UserDay.aggregate<{ _id: string; users: number; visits: number }>([
    { $match: { day: { $gte: from, $lte: to } } },
    { $group: { _id: '$day', users: { $sum: 1 }, visits: { $sum: '$visits' } } }
  ]);
  const byDay = new Map(rows.map((row) => [row._id, row]));
  return daysBetween(from, to).map((day) => ({
    day,
    users: byDay.get(day)?.users ?? 0,
    visits: byDay.get(day)?.visits ?? 0
  }));
}

async function signupsByWeek(firstWeek: string, lastWeek: string): Promise<Overview['signups']> {
  const rows = await AdminUser.aggregate<{ _id: Date; users: number }>([
    { $match: { createdAt: { $gte: startOfDay(firstWeek) } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } },
        users: { $sum: 1 }
      }
    }
  ]);
  const byWeek = new Map(rows.map((row) => [toDay(row._id), row.users]));
  const weeks: Overview['signups'] = [];
  for (let week = firstWeek; week <= lastWeek; week = shiftDay(week, 7)) {
    weeks.push({ week, users: byWeek.get(week) ?? 0 });
  }
  return weeks;
}

/**
 * Per signup week: how many of its people were active at all in the weeks that
 * followed. Done in memory over just the recent signups' days, because the
 * question — which of this cohort has a day in week k — is a join an
 * aggregation would make harder to read than the loop.
 */
async function cohortRetention(firstWeek: string, today: string): Promise<Overview['cohorts']> {
  const users = await AdminUser.find({ createdAt: { $gte: startOfDay(firstWeek) } }, { createdAt: 1 }).lean();
  const cohortOf = new Map(users.map((user) => [String(user._id), weekStart(toDay(user.createdAt))]));
  const days = await UserDay.find({ userId: { $in: [...cohortOf.keys()] }, day: { $gte: firstWeek } }, { userId: 1, day: 1 }).lean();

  // Weeks each person was active in, counted from their own signup week.
  const activeWeeks = new Map<string, Set<number>>();
  for (const { userId, day } of days) {
    const cohort = cohortOf.get(userId);
    if (!cohort) continue;
    const offset = weeksBetween(cohort, day);
    if (!activeWeeks.has(userId)) activeWeeks.set(userId, new Set());
    activeWeeks.get(userId)!.add(offset);
  }

  const cohorts = new Map<string, { size: number; retention: Record<string, number | null> }>();
  for (const [userId, cohort] of cohortOf) {
    if (!cohorts.has(cohort)) {
      const retention: Record<string, number | null> = {};
      // A week that has not started yet has no answer, which is not the same as nobody.
      for (const weeks of RETENTION_WEEKS) {
        retention[String(weeks)] = shiftDay(cohort, weeks * 7) <= today ? 0 : null;
      }
      cohorts.set(cohort, { size: 0, retention });
    }
    const entry = cohorts.get(cohort)!;
    entry.size += 1;
    for (const weeks of RETENTION_WEEKS) {
      if (entry.retention[String(weeks)] !== null && activeWeeks.get(userId)?.has(weeks)) {
        entry.retention[String(weeks)] = (entry.retention[String(weeks)] as number) + 1;
      }
    }
  }

  return [...cohorts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, entry]) => ({ week, ...entry }));
}

async function opensByWeek(firstWeek: string): Promise<Overview['opensByWeek']> {
  const rows = await UserDay.aggregate<{ _id: { week: Date; module: string }; opens: number }>([
    { $match: { day: { $gte: firstWeek }, modules: { $exists: true } } },
    {
      $project: {
        week: {
          $dateTrunc: { date: { $dateFromString: { dateString: '$day' } }, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' }
        },
        modules: { $objectToArray: '$modules' }
      }
    },
    { $unwind: '$modules' },
    { $group: { _id: { week: '$week', module: '$modules.k' }, opens: { $sum: '$modules.v' } } }
  ]);
  const byWeek = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const week = toDay(row._id.week);
    byWeek.set(week, { ...byWeek.get(week), [row._id.module]: row.opens });
  }
  return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([week, modules]) => ({ week, modules }));
}

async function pairActivity(activeIdsLast7: Promise<string[]>): Promise<Overview['pairs']> {
  // A pair is a group of exactly two. Emails are how groups name their members.
  const groups = await AdminGroup.find({ deletedAt: null, $expr: { $eq: [{ $size: '$members' }, 2] } }, { members: 1 }).lean();
  if (groups.length === 0) return { total: 0, bothActiveLast7: 0 };

  const activeIds = await activeIdsLast7;
  const active = await AdminUser.find({ _id: { $in: activeIds } }, { email: 1 }).lean();
  const activeEmails = new Set(active.map((user) => user.email));

  return {
    total: groups.length,
    bothActiveLast7: groups.filter((group) => group.members.every((member) => activeEmails.has(member.email))).length
  };
}

async function assistantsThisMonth(now: Date): Promise<Overview['assistants']> {
  const [row] = await AuditEvent.aggregate<{ calls: number; tokens: number; failed: number }>([
    { $match: { action: 'call', service: 'mcp-service', at: { $gte: monthStart(now) } } },
    {
      $group: {
        _id: null,
        calls: { $sum: 1 },
        tokens: { $sum: '$tool.tokens' },
        failed: { $sum: { $cond: ['$tool.failed', 1, 0] } }
      }
    }
  ]);
  return { callsThisMonth: row?.calls ?? 0, tokensThisMonth: row?.tokens ?? 0, failedThisMonth: row?.failed ?? 0 };
}

export async function getOverview({ days = 30, now = new Date() }: { days?: number; now?: Date } = {}): Promise<Overview> {
  const today = toDay(now);
  const from = shiftDay(today, -(days - 1));
  const lastSignupWeek = weekStart(today);
  const firstSignupWeek = shiftDay(lastSignupWeek, -(SIGNUP_WEEKS - 1) * 7);
  const firstCohortWeek = shiftDay(lastSignupWeek, -(COHORT_WEEKS - 1) * 7);
  // Asked once: the "last 7 days" tile and the pairs both need it.
  const activeIdsLast7 = activeSince(shiftDay(today, -6));

  const [
    total,
    pendingDeletions,
    activeToday,
    activeLast7,
    activeLast30,
    daily,
    backfilled,
    signups,
    cohorts,
    opens,
    pairs,
    assistants,
    marketUsage
  ] = await Promise.all([
    AdminUser.countDocuments({}),
    AdminUser.countDocuments({ deletionRequestedAt: { $ne: null }, deletionConfirmedAt: null }),
    UserDay.countDocuments({ day: today }),
    activeIdsLast7,
    activeSince(shiftDay(today, -29)),
    dailyActivity(from, today),
    UserDay.exists({ day: { $gte: from }, backfilled: true }),
    signupsByWeek(firstSignupWeek, lastSignupWeek),
    cohortRetention(firstCohortWeek, today),
    opensByWeek(firstCohortWeek),
    pairActivity(activeIdsLast7),
    assistantsThisMonth(now),
    AdminApiUsage.findOne({ provider: MARKET_DATA_PROVIDER, date: today }).lean()
  ]);

  return {
    generatedAt: now.toISOString(),
    range: { from, to: today },
    accounts: { total, pendingDeletions },
    active: { today: activeToday, last7: activeLast7.length, last30: activeLast30.length },
    daily,
    includesBackfilled: backfilled !== null,
    signups,
    cohorts,
    opensByWeek: opens,
    pairs,
    assistants,
    marketData: { used: marketUsage?.count ?? 0, limit: MARKET_DATA_DAILY_LIMIT, date: today }
  };
}
