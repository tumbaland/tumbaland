import { Types } from 'mongoose';
import { ApiKey, AuditEvent, NotFoundError, OAuthClient, RefreshToken, UserDay } from '@tumbaland/backend-core';
import { AdminGroup, AdminSession, AdminUser } from '../models/readModels';
import { daysBetween, shiftDay, startOfDay, toDay } from './dates';
import { deviceLabel } from './devices';
import { readQuota, type QuotaReading } from './quota';
import { deletionStateOf, displayName, type DeletionState } from './usersService';

/** How far back the visit strip and the module counts reach. */
export const VISIT_DAYS = 90;
/** How far back assistant use is summed. Matches the "last 30 days" column in the list. */
export const ASSISTANT_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string | null;
    roles: string[];
    createdAt: string;
    lastLoginAt: string | null;
    deletion: {
      state: DeletionState;
      requestedAt: string | null;
      confirmedAt: string | null;
      confirmedBy: string | null;
    };
  };
  visits: {
    from: string;
    to: string;
    /** Only the days the person was active. */
    days: Array<{ day: string; visits: number; platform: Record<string, number>; country: string | null; backfilled: boolean }>;
    totalActiveDays: number;
    firstActiveDay: string | null;
    platforms: Record<string, number>;
    countries: Record<string, number>;
  };
  modules: {
    opens: Array<{ module: string; opens: number }>;
    writes: Array<{ service: string; resource: string; action: string; count: number }>;
  };
  quota: {
    /** Billed to this person: their own, plus everything in groups they own. */
    own: QuotaReading;
    /** Groups of someone else's: those bytes and seats are the owner's, not this person's. */
    pooled: Array<{ billedTo: string; groups: string[]; quota: QuotaReading }>;
  };
  apps: {
    connections: Array<{
      clientId: string;
      clientName: string;
      scopes: string[];
      tenants: string[];
      grantedAt: string;
      lastUsedAt: string | null;
    }>;
    keys: Array<{
      name: string;
      state: 'active' | 'revoked' | 'expired';
      scopes: string[];
      tenants: string[];
      createdAt: string;
      lastUsedAt: string | null;
      expiresAt: string | null;
    }>;
    devices: Array<{ label: string; country: string | null; createdAt: string; lastSeenAt: string }>;
  };
  assistants: {
    windowDays: number;
    clients: Array<{
      credentialId: string | null;
      label: string;
      kind: string;
      calls: number;
      failed: number;
      tokens: number;
      avgMs: number;
      lastAt: string | null;
    }>;
    tools: Array<{ name: string; calls: number; failed: number; tokens: number; avgMs: number }>;
    daily: Array<{ day: string; calls: number; tokens: number }>;
    /** What keys and assistants read and wrote in the services themselves, other than through the tools. */
    elsewhere: Array<{ service: string; action: string; actorKind: string; count: number }>;
  };
}

const iso = (date: Date | null | undefined): string | null => date?.toISOString() ?? null;

async function visitsSection(userId: string, today: string): Promise<{ visits: UserDetail['visits']; opens: UserDetail['modules']['opens'] }> {
  const from = shiftDay(today, -(VISIT_DAYS - 1));
  const [days, totalActiveDays, first] = await Promise.all([
    UserDay.find({ userId, day: { $gte: from } }).sort({ day: 1 }).lean(),
    UserDay.countDocuments({ userId }),
    UserDay.findOne({ userId }, { day: 1 }).sort({ day: 1 }).lean()
  ]);

  const platforms: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const opens = new Map<string, number>();
  for (const day of days) {
    for (const [platform, count] of Object.entries(day.platform ?? {})) {
      platforms[platform] = (platforms[platform] ?? 0) + (count as number);
    }
    if (day.country) countries[day.country] = (countries[day.country] ?? 0) + 1;
    for (const [module, count] of Object.entries(day.modules ?? {})) {
      opens.set(module, (opens.get(module) ?? 0) + (count as number));
    }
  }

  return {
    visits: {
      from,
      to: today,
      days: days.map((day) => ({
        day: day.day,
        visits: day.visits ?? 0,
        platform: { ...day.platform } as Record<string, number>,
        country: day.country ?? null,
        backfilled: day.backfilled === true
      })),
      totalActiveDays,
      firstActiveDay: first?.day ?? null,
      platforms,
      countries
    },
    opens: [...opens.entries()].map(([module, count]) => ({ module, opens: count })).sort((a, b) => b.opens - a.opens || a.module.localeCompare(b.module))
  };
}

/** Writes a person made themselves, by service, thing and kind. Counts only: never what was written. */
async function writesSection(userId: string, since: Date): Promise<UserDetail['modules']['writes']> {
  const rows = await AuditEvent.aggregate<{ _id: { service: string; resource: string; action: string }; count: number }>([
    { $match: { userId, actorKind: 'person', action: { $in: ['create', 'update', 'delete'] }, at: { $gte: since } } },
    { $group: { _id: { service: '$service', resource: '$resource', action: '$action' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  return rows.map((row) => ({ ...row._id, count: row.count }));
}

async function quotaSection(email: string, now: Date): Promise<UserDetail['quota']> {
  const own = await readQuota(email, now);

  const groups = await AdminGroup.find({ 'members.email': email, deletedAt: null }, { name: 1, createdBy: 1, members: 1 }).lean();
  const byOwner = new Map<string, string[]>();
  for (const group of groups) {
    const owner = group.members.find((member) => member.role === 'owner')?.email ?? group.createdBy;
    if (!owner || owner === email) continue;
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), group.name]);
  }

  const pooled = await Promise.all(
    [...byOwner.entries()].map(async ([billedTo, names]) => ({
      billedTo,
      groups: names,
      quota: await readQuota(billedTo, now)
    }))
  );
  return { own, pooled };
}

async function appsSection(userId: string, now: Date): Promise<UserDetail['apps']> {
  const [tokens, keys, sessions] = await Promise.all([
    // Named fields, so the token hash cannot come along.
    RefreshToken.find({ userId, revokedAt: { $exists: false } })
      .select('clientId scopes tenants grantedAt lastUsedAt createdAt')
      .lean(),
    ApiKey.find({ userId }).select('name scopes tenants lastUsedAt expiresAt revokedAt createdAt').sort({ createdAt: -1 }).lean(),
    AdminSession.find({ userId: new Types.ObjectId(userId), expiresAt: { $gt: now } }).sort({ lastSeenAt: -1 }).lean()
  ]);

  const clients = await OAuthClient.find({ clientId: { $in: tokens.map((token) => token.clientId) } })
    .select('clientId clientName')
    .lean();
  const nameOf = new Map(clients.map((client) => [client.clientId, client.clientName]));

  return {
    connections: tokens.map((token) => ({
      clientId: token.clientId,
      clientName: nameOf.get(token.clientId) ?? 'Unknown app',
      scopes: token.scopes,
      tenants: token.tenants ?? [],
      grantedAt: (token.grantedAt ?? token.createdAt).toISOString(),
      lastUsedAt: iso(token.lastUsedAt)
    })),
    keys: keys.map((key) => ({
      name: key.name,
      state: key.revokedAt ? 'revoked' : key.expiresAt && key.expiresAt <= now ? 'expired' : 'active',
      scopes: key.scopes,
      tenants: key.tenants ?? [],
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: iso(key.lastUsedAt),
      expiresAt: iso(key.expiresAt)
    })),
    devices: sessions.map((session) => ({
      label: deviceLabel(session.userAgent),
      country: session.country ?? null,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString()
    }))
  };
}

async function assistantsSection(userId: string, today: string): Promise<UserDetail['assistants']> {
  const from = shiftDay(today, -(ASSISTANT_DAYS - 1));
  const since = startOfDay(from);
  const calls = { userId, action: 'call', service: 'mcp-service', at: { $gte: since } };

  const [clients, tools, daily, elsewhere] = await Promise.all([
    AuditEvent.aggregate<{
      _id: { credentialId: string | null; label: string; kind: string };
      calls: number;
      failed: number;
      tokens: number;
      avgMs: number;
      lastAt: Date;
    }>([
      { $match: calls },
      {
        $group: {
          _id: { credentialId: '$actorCredentialId', label: '$actorLabel', kind: '$actorKind' },
          calls: { $sum: 1 },
          failed: { $sum: { $cond: ['$tool.failed', 1, 0] } },
          tokens: { $sum: '$tool.tokens' },
          avgMs: { $avg: '$tool.ms' },
          lastAt: { $max: '$at' }
        }
      },
      { $sort: { calls: -1 } }
    ]),
    AuditEvent.aggregate<{ _id: string; calls: number; failed: number; tokens: number; avgMs: number }>([
      { $match: calls },
      {
        $group: {
          _id: '$tool.name',
          calls: { $sum: 1 },
          failed: { $sum: { $cond: ['$tool.failed', 1, 0] } },
          tokens: { $sum: '$tool.tokens' },
          avgMs: { $avg: '$tool.ms' }
        }
      },
      { $sort: { tokens: -1 } }
    ]),
    AuditEvent.aggregate<{ _id: string; calls: number; tokens: number }>([
      { $match: calls },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'UTC' } },
          calls: { $sum: 1 },
          tokens: { $sum: '$tool.tokens' }
        }
      }
    ]),
    AuditEvent.aggregate<{ _id: { service: string; action: string; actorKind: string }; count: number }>([
      { $match: { userId, actorKind: { $in: ['key', 'assistant'] }, action: { $ne: 'call' }, at: { $gte: since } } },
      { $group: { _id: { service: '$service', action: '$action', actorKind: '$actorKind' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const byDay = new Map(daily.map((row) => [row._id, row]));
  return {
    windowDays: ASSISTANT_DAYS,
    clients: clients.map((row) => ({
      credentialId: row._id.credentialId ?? null,
      label: row._id.label,
      kind: row._id.kind,
      calls: row.calls,
      failed: row.failed,
      tokens: row.tokens,
      avgMs: Math.round(row.avgMs ?? 0),
      lastAt: iso(row.lastAt)
    })),
    tools: tools.map((row) => ({
      name: row._id,
      calls: row.calls,
      failed: row.failed,
      tokens: row.tokens,
      avgMs: Math.round(row.avgMs ?? 0)
    })),
    daily: daysBetween(from, today).map((day) => ({
      day,
      calls: byDay.get(day)?.calls ?? 0,
      tokens: byDay.get(day)?.tokens ?? 0
    })),
    elsewhere: elsewhere.map((row) => ({ ...row._id, count: row.count }))
  };
}

export async function getUserDetail(id: string, now: Date = new Date()): Promise<UserDetail> {
  const user = Types.ObjectId.isValid(id) ? await AdminUser.findById(id).lean() : null;
  if (!user) throw new NotFoundError('User not found');

  const userId = String(user._id);
  const today = toDay(now);
  const writesSince = new Date(now.getTime() - VISIT_DAYS * DAY_MS);

  const confirmedById = user.deletionConfirmedBy;
  const [{ visits, opens }, writes, quota, apps, assistants, confirmedBy] = await Promise.all([
    visitsSection(userId, today),
    writesSection(userId, writesSince),
    quotaSection(user.email, now),
    appsSection(userId, now),
    assistantsSection(userId, today),
    // By email, as the deletions list gives it: the stored value is a user id.
    confirmedById && Types.ObjectId.isValid(confirmedById)
      ? AdminUser.findById(confirmedById, { email: 1 }).lean()
      : Promise.resolve(null)
  ]);

  return {
    user: {
      id: userId,
      email: user.email,
      name: displayName(user),
      roles: user.roles ?? [],
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: iso(user.lastLoginAt),
      deletion: {
        state: deletionStateOf(user),
        requestedAt: iso(user.deletionRequestedAt),
        confirmedAt: iso(user.deletionConfirmedAt),
        confirmedBy: confirmedBy?.email ?? null
      }
    },
    visits,
    modules: { opens, writes },
    quota,
    apps,
    assistants
  };
}
