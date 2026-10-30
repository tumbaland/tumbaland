import { PaymentRequiredError, TooManyRequestsError, getEntitlements, getUsage, recordUsage, resolveLimits, UNLIMITED } from '@tumbaland/backend-core';
import { AssistantPreference } from '../models/AssistantPreference';
import { AssistantUsage } from '../models/AssistantUsage';

/**
 * What a person may still spend on assistants this month, and the brakes that
 * hold whatever their allowance says.
 *
 * The allowance is the `assistantSpend` meter: a plan limit, which an admin sets
 * per plan and can override per person, counted per calendar month in
 * ten-thousandths of a dollar. It is charged to whoever mentioned the bot, not
 * to the chat or the bot's owner, because plans and payments belong to people.
 */

const METER = 'assistantSpend' as const;

/** Per person, and not configurable: backstops against a loop, whatever the allowance. */
export const MAX_PER_MINUTE = 6;
export const MAX_PER_DAY = 150;

export interface AllowanceView {
  /** The plan's limit, or null for unlimited. */
  limit: number | null;
  used: number;
  /** Share of the limit used, 0 to 100 and beyond; null when there is no limit. */
  percent: number | null;
  /** Their own lower cap, as a share of the limit; null for none. */
  capPercent: number | null;
  /** True when the next reply would not fit, under the limit or their own cap. */
  exhausted: boolean;
  /** First day of next month, when the meter starts again. */
  resetsOn: string;
}

const resetDay = (now: Date): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

export async function allowanceFor(person: { id: string; email: string }, now: Date = new Date()): Promise<AllowanceView> {
  const [entitlements, used, preference] = await Promise.all([
    getEntitlements(person.email),
    getUsage(person.email, METER, now),
    AssistantPreference.findOne({ userId: person.id })
  ]);
  // A payment-service that predates the meter does not list it. The plan's own default stands in,
  // so a mismatch during a rollout limits people rather than quietly letting everyone spend freely.
  const ceiling = entitlements.limits.meters[METER] ?? resolveLimits(entitlements.planCode).meters[METER];
  const unlimited = ceiling === UNLIMITED || ceiling < 0;
  const capPercent = preference?.capPercent ?? null;
  const stopAt = unlimited ? Infinity : capPercent ? Math.floor((ceiling * capPercent) / 100) : ceiling;
  return {
    limit: unlimited ? null : ceiling,
    used,
    percent: unlimited || ceiling === 0 ? null : Math.round((used / ceiling) * 100),
    capPercent,
    exhausted: used >= stopAt,
    resetsOn: resetDay(now)
  };
}

export async function setCap(personId: string, capPercent: number | null): Promise<void> {
  await AssistantPreference.updateOne({ userId: personId }, { $set: { capPercent } }, { upsert: true });
}

/** Counts a reply against the person's allowance. */
export async function chargeSpend(email: string, units: number): Promise<void> {
  if (units > 0) await recordUsage(email, METER, units);
}

/**
 * The brakes, in the order a person would hit them. Throws with a sentence the
 * chat can show as it is: the first two are the allowance, the last two a pause.
 */
export async function assertCanAsk(person: { id: string; email: string }, now: Date = new Date()): Promise<AllowanceView> {
  const allowance = await allowanceFor(person, now);
  if (allowance.exhausted) {
    throw new PaymentRequiredError("You've used this month's assistant allowance", { code: 'ASSISTANT_ALLOWANCE', meter: METER });
  }
  const [lastMinute, lastDay] = await Promise.all([
    AssistantUsage.countDocuments({ mentionerId: person.id, createdAt: { $gte: new Date(now.getTime() - 60_000) } }),
    AssistantUsage.countDocuments({ mentionerId: person.id, createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60_000) } })
  ]);
  if (lastMinute >= MAX_PER_MINUTE) throw new TooManyRequestsError('That is a lot of questions at once. Try again in a minute.');
  if (lastDay >= MAX_PER_DAY) throw new TooManyRequestsError("That's a lot of questions for one day. Try again tomorrow.");
  return allowance;
}

// ─── For the admin page ──────────────────────────────────────────────────────

export interface AdminUsage {
  /** YYYY-MM */
  month: string;
  totals: { replies: number; failed: number; units: number };
  byModel: Array<{ model: string; replies: number; units: number }>;
  byPerson: Array<{ email: string; replies: number; units: number; limit: number | null; percent: number | null; exhausted: boolean }>;
  byChat: Array<{ conversationId: string; replies: number; units: number }>;
}

const monthBounds = (month: string): { start: Date; end: Date } => {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return { start: new Date(Date.UTC(year, index - 1, 1)), end: new Date(Date.UTC(year, index, 1)) };
};

/** Everyone's usage for one month, most expensive first. People are capped at twenty; the rest are in the totals. */
export async function adminUsage(month: string): Promise<AdminUsage> {
  const { start, end } = monthBounds(month);
  const match = { $match: { createdAt: { $gte: start, $lt: end } } };
  const sum = { replies: { $sum: 1 }, units: { $sum: '$units' } };
  const [totals, byModel, byPerson, byChat] = await Promise.all([
    AssistantUsage.aggregate<{ replies: number; failed: number; units: number }>([
      match,
      { $group: { _id: null, ...sum, failed: { $sum: { $cond: [{ $eq: ['$outcome', 'ok'] }, 0, 1] } } } }
    ]),
    AssistantUsage.aggregate<{ _id: string; replies: number; units: number }>([match, { $group: { _id: '$modelId', ...sum } }, { $sort: { units: -1 } }]),
    AssistantUsage.aggregate<{ _id: { id: string; email: string }; replies: number; units: number }>([
      match,
      { $group: { _id: { id: '$mentionerId', email: '$mentionerEmail' }, ...sum } },
      { $sort: { units: -1 } },
      { $limit: 20 }
    ]),
    AssistantUsage.aggregate<{ _id: string; replies: number; units: number }>([match, { $group: { _id: '$conversationId', ...sum } }, { $sort: { units: -1 } }, { $limit: 20 }])
  ]);

  const people = await Promise.all(
    byPerson.map(async (row) => {
      // The allowance is read as of the month asked for, so a past month shows what was used then.
      const allowance = await allowanceFor({ id: row._id.id, email: row._id.email }, new Date(start.getTime() + 1));
      return { email: row._id.email, replies: row.replies, units: row.units, limit: allowance.limit, percent: allowance.percent, exhausted: allowance.exhausted };
    })
  );

  return {
    month,
    totals: { replies: totals[0]?.replies ?? 0, failed: totals[0]?.failed ?? 0, units: totals[0]?.units ?? 0 },
    byModel: byModel.map((row) => ({ model: row._id, replies: row.replies, units: row.units })),
    byPerson: people,
    byChat: byChat.map((row) => ({ conversationId: row._id, replies: row.replies, units: row.units }))
  };
}
