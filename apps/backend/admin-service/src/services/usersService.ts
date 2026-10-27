import { ApiKey, AuditEvent, escapeRegex, getEntitlements, RefreshToken, UserDay } from '@tumbaland/backend-core';
import { AdminUser, type AdminUserDoc } from '../models/readModels';
import { shiftDay, toDay } from './dates';
import { storageUsed } from './quota';

export const USER_SORTS = ['lastVisit', 'signup', 'activeDays30', 'visits30', 'email'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export interface UserListQuery {
  sort?: UserSort;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  /** Matches part of an email or a name. */
  q?: string;
  now?: Date;
}

export type DeletionState = 'requested' | 'closed' | null;

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastVisitAt: string | null;
  activeDays7: number;
  activeDays30: number;
  visits30: number;
  topModules: Array<{ module: string; opens: number }>;
  plan: { code: string; stale: boolean };
  storage: { used: number; limit: number };
  /** Live connected assistants (distinct apps with an unrevoked refresh token). */
  connections: number;
  /** API keys that are neither revoked nor expired. */
  keys: number;
  assistantCalls30: number;
  deletion: DeletionState;
  isAdmin: boolean;
}

export interface UserList {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
}

export const displayName = (user: Pick<AdminUserDoc, 'firstName' | 'lastName' | 'googleName'>): string | null =>
  [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.googleName || null;

export const deletionStateOf = (user: Pick<AdminUserDoc, 'deletionRequestedAt' | 'deletionConfirmedAt'>): DeletionState =>
  user.deletionConfirmedAt ? 'closed' : user.deletionRequestedAt ? 'requested' : null;

interface Activity {
  lastAt: Date | null;
  activeDays7: number;
  activeDays30: number;
  visits30: number;
}

/**
 * Everyone's activity in one pass over `user_days`.
 *
 * Every account, not just the page asked for, because the list sorts by it —
 * "who was here most recently" cannot be answered a page at a time. This is an
 * administrator's occasional screen over at most a few thousand accounts, which
 * is a single indexed scan; if that ever stops being true, this is the place
 * to precompute.
 */
async function activityByUser(today: string, onlyUsers?: string[]): Promise<Map<string, Activity>> {
  const since7 = shiftDay(today, -6);
  const since30 = shiftDay(today, -29);
  const rows = await UserDay.aggregate<{ _id: string } & Activity>([
    // A search narrows the scan to the accounts it matched, through the
    // (userId, day) index, instead of reading every day of everyone.
    ...(onlyUsers ? [{ $match: { userId: { $in: onlyUsers } } }] : []),
    {
      $group: {
        _id: '$userId',
        lastAt: { $max: '$lastAt' },
        activeDays7: { $sum: { $cond: [{ $gte: ['$day', since7] }, 1, 0] } },
        activeDays30: { $sum: { $cond: [{ $gte: ['$day', since30] }, 1, 0] } },
        visits30: { $sum: { $cond: [{ $gte: ['$day', since30] }, '$visits', 0] } }
      }
    }
  ]);
  return new Map(rows.map((row) => [row._id, row]));
}

async function topModulesByUser(userIds: string[], since: string): Promise<Map<string, Array<{ module: string; opens: number }>>> {
  if (userIds.length === 0) return new Map();
  const rows = await UserDay.aggregate<{ _id: { userId: string; module: string }; opens: number }>([
    { $match: { userId: { $in: userIds }, day: { $gte: since }, modules: { $exists: true } } },
    { $project: { userId: 1, modules: { $objectToArray: '$modules' } } },
    { $unwind: '$modules' },
    { $group: { _id: { userId: '$userId', module: '$modules.k' }, opens: { $sum: '$modules.v' } } }
  ]);
  const byUser = new Map<string, Array<{ module: string; opens: number }>>();
  for (const row of rows) {
    const list = byUser.get(row._id.userId) ?? [];
    list.push({ module: row._id.module, opens: row.opens });
    byUser.set(row._id.userId, list);
  }
  // Ties by name, so the same data always lists the same way.
  for (const list of byUser.values()) list.sort((a, b) => b.opens - a.opens || a.module.localeCompare(b.module));
  return byUser;
}

async function countsByUser(userIds: string[], now: Date, since: Date) {
  const [connections, keys, calls] = await Promise.all([
    RefreshToken.aggregate<{ _id: string; apps: string[] }>([
      { $match: { userId: { $in: userIds }, revokedAt: { $exists: false } } },
      { $group: { _id: '$userId', apps: { $addToSet: '$clientId' } } }
    ]),
    ApiKey.aggregate<{ _id: string; keys: number }>([
      {
        $match: {
          userId: { $in: userIds },
          revokedAt: { $exists: false },
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }]
        }
      },
      { $group: { _id: '$userId', keys: { $sum: 1 } } }
    ]),
    AuditEvent.aggregate<{ _id: string; calls: number }>([
      { $match: { userId: { $in: userIds }, action: 'call', service: 'mcp-service', at: { $gte: since } } },
      { $group: { _id: '$userId', calls: { $sum: 1 } } }
    ])
  ]);
  return {
    connections: new Map(connections.map((row) => [row._id, row.apps.length])),
    keys: new Map(keys.map((row) => [row._id, row.keys])),
    calls: new Map(calls.map((row) => [row._id, row.calls]))
  };
}

const NEVER = Number.NEGATIVE_INFINITY;

/** Orders two rows; people with nothing to compare (never visited) sort last whichever way it goes. */
function compare(sort: UserSort, a: UserRow, b: UserRow): number {
  switch (sort) {
    case 'signup':
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    case 'activeDays30':
      return a.activeDays30 - b.activeDays30;
    case 'visits30':
      return a.visits30 - b.visits30;
    case 'email':
      return a.email.localeCompare(b.email);
    case 'lastVisit':
    default: {
      const left = a.lastVisitAt ? Date.parse(a.lastVisitAt) : NEVER;
      const right = b.lastVisitAt ? Date.parse(b.lastVisitAt) : NEVER;
      return left === right ? 0 : left < right ? -1 : 1;
    }
  }
}

export async function listUsers(query: UserListQuery = {}): Promise<UserList> {
  const now = query.now ?? new Date();
  const sort = query.sort ?? 'lastVisit';
  const order = query.order ?? (sort === 'email' ? 'asc' : 'desc');
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const requestedPage = Math.max(query.page ?? 1, 1);

  const filter: Record<string, unknown> = {};
  const q = query.q?.trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: pattern }, { firstName: pattern }, { lastName: pattern }, { googleName: pattern }];
  }

  const users = await AdminUser.find(filter, {
      email: 1,
      firstName: 1,
      lastName: 1,
      googleName: 1,
      roles: 1,
      createdAt: 1,
      lastLoginAt: 1,
      deletionRequestedAt: 1,
      deletionConfirmedAt: 1
    }).lean();
  const activity = await activityByUser(
    toDay(now),
    q ? users.map((user) => String(user._id)) : undefined
  );

  // Rows with the activity columns, which is all the ordering needs. The rest
  // (plan, storage, connections) is only fetched for the page that is shown.
  const rows = users.map((user): UserRow => {
    const seen = activity.get(String(user._id));
    return {
      id: String(user._id),
      email: user.email,
      name: displayName(user),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lastVisitAt: seen?.lastAt?.toISOString() ?? null,
      activeDays7: seen?.activeDays7 ?? 0,
      activeDays30: seen?.activeDays30 ?? 0,
      visits30: seen?.visits30 ?? 0,
      topModules: [],
      plan: { code: '', stale: false },
      storage: { used: 0, limit: 0 },
      connections: 0,
      keys: 0,
      assistantCalls30: 0,
      deletion: deletionStateOf(user),
      isAdmin: user.roles?.includes('admin') ?? false
    };
  });

  rows.sort((a, b) => {
    const never = sort === 'lastVisit' ? Number(!a.lastVisitAt) - Number(!b.lastVisitAt) : 0;
    if (never !== 0) return never;
    const result = compare(sort, a, b);
    return order === 'asc' ? result : -result;
  });

  const total = rows.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(requestedPage, totalPages);
  const shown = rows.slice((page - 1) * limit, page * limit);

  const ids = shown.map((row) => row.id);
  const emails = shown.map((row) => row.email);
  const [modules, counts, storage, plans] = await Promise.all([
    topModulesByUser(ids, shiftDay(toDay(now), -29)),
    countsByUser(ids, now, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    storageUsed(emails),
    Promise.all(emails.map((email) => getEntitlements(email)))
  ]);

  shown.forEach((row, index) => {
    const entitlements = plans[index];
    row.topModules = (modules.get(row.id) ?? []).slice(0, 3);
    row.plan = { code: entitlements.planCode, stale: entitlements.stale === true };
    row.storage = { used: storage.get(row.email.toLowerCase()) ?? 0, limit: entitlements.limits.meters.storageBytes };
    row.connections = counts.connections.get(row.id) ?? 0;
    row.keys = counts.keys.get(row.id) ?? 0;
    row.assistantCalls30 = counts.calls.get(row.id) ?? 0;
  });

  return { users: shown, total, page, totalPages };
}
