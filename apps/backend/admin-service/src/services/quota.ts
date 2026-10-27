import {
  currentPeriod,
  getEntitlements,
  METER_DEFINITIONS,
  UsageMeter,
  type MeterKey
} from '@tumbaland/backend-core';

/**
 * Meters that are defined, with limits on every plan, but that nothing
 * increments yet: no code path calls `consumeQuota('aiJobs')`. Shown as "not
 * metered" instead of a 0 that reads as "this person uses none".
 */
export const NOT_METERED: readonly MeterKey[] = ['aiJobs'];

export interface MeterReading {
  meter: MeterKey;
  label: string;
  unit: 'bytes' | 'count';
  /** `ALL`, or the `YYYY-MM` the count belongs to. */
  period: string;
  used: number;
  /** `-1` is no ceiling. */
  limit: number;
  metered: boolean;
}

export interface QuotaReading {
  plan: string;
  /** The plan could not be looked up, so the limits are the free fallback and may be wrong. */
  stale: boolean;
  meters: MeterReading[];
}

/**
 * What an account has used against what its plan allows.
 *
 * `email` is the billing subject: usage is kept under an email, and a pooled
 * meter (a group's storage) is kept under the group *owner's*, so for a member
 * of someone else's group this is the owner's reading, not their own.
 */
export async function readQuota(email: string, now: Date = new Date()): Promise<QuotaReading> {
  const subject = email.trim().toLowerCase();
  const [entitlements, rows] = await Promise.all([
    getEntitlements(subject),
    UsageMeter.find({ subjectId: subject }).lean()
  ]);

  const meters = METER_DEFINITIONS.map((definition): MeterReading => {
    const period = currentPeriod(definition.key, now);
    const row = rows.find((candidate) => candidate.meter === definition.key && candidate.period === period);
    return {
      meter: definition.key,
      label: definition.label,
      unit: definition.unit,
      period,
      used: row?.count ?? 0,
      limit: entitlements.limits.meters[definition.key],
      metered: !NOT_METERED.includes(definition.key)
    };
  });

  return { plan: entitlements.planCode, stale: entitlements.stale === true, meters };
}

/** Bytes stored under each of these billing subjects, for lists that only need the one meter. */
export async function storageUsed(emails: string[]): Promise<Map<string, number>> {
  const rows = await UsageMeter.find({
    subjectId: { $in: emails.map((email) => email.toLowerCase()) },
    meter: 'storageBytes',
    period: 'ALL'
  }).lean();
  return new Map(rows.map((row) => [row.subjectId, row.count]));
}
