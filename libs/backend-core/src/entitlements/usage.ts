import logger from '../logging/logger';
import { PaymentRequiredError } from '../errors/HttpError';
import { UsageMeter, currentPeriod } from './UsageMeter';
import { MeterKey, METER_KEYS, UNLIMITED, fitsWithin } from './definitions';
import { Entitlements } from './types';
import { getEntitlementsMode } from './mode';

export interface QuotaRequest {
  /** Who the usage is billed to — see `IUsageMeter.subjectId`. */
  subjectId: string;
  meter: MeterKey;
  /** How much this request wants. Bytes for `storageBytes`, otherwise a count. */
  amount?: number;
  entitlements: Entitlements;
  /** Attached to the observe-mode log line so a would-block can be traced to a route. */
  route?: string;
}

/** Current count for one meter in its live period. */
export async function getUsage(subjectId: string, meter: MeterKey, now?: Date): Promise<number> {
  const doc = await UsageMeter.findOne({
    subjectId: subjectId.toLowerCase(),
    meter,
    period: currentPeriod(meter, now)
  }).lean();
  return doc?.count ?? 0;
}

/** Every meter at once, for the account page and the pricing table's live numbers. */
export async function getUsageSnapshot(subjectId: string, now?: Date): Promise<Record<MeterKey, number>> {
  const periods = METER_KEYS.map(meter => ({ meter, period: currentPeriod(meter, now) }));
  const docs = await UsageMeter.find({
    subjectId: subjectId.toLowerCase(),
    $or: periods.map(p => ({ meter: p.meter, period: p.period }))
  }).lean();

  const snapshot = Object.fromEntries(METER_KEYS.map(k => [k, 0])) as Record<MeterKey, number>;
  for (const doc of docs) {
    if ((METER_KEYS as readonly string[]).includes(doc.meter)) snapshot[doc.meter as MeterKey] = doc.count;
  }
  return snapshot;
}

function quotaError(req: QuotaRequest, used: number, limit: number): PaymentRequiredError {
  return new PaymentRequiredError(`Limit reached for ${req.meter}`, {
    code: 'QUOTA_EXCEEDED',
    meter: req.meter,
    used,
    limit,
    planCode: req.entitlements.planCode,
    upgradeTo: req.entitlements.upgradeTo
  });
}

function logWouldBlock(req: QuotaRequest, used: number, limit: number): void {
  logger.info('entitlement.would_block', {
    event: 'entitlement.would_block',
    meter: req.meter,
    subjectId: req.subjectId,
    amount: req.amount ?? 1,
    used,
    limit,
    planCode: req.entitlements.planCode,
    route: req.route,
    stale: req.entitlements.stale === true
  });
}

/**
 * Read-only check for cumulative meters whose real increment happens later
 * (storage is counted when the upload lands, not when it is authorized).
 *
 * Racy by construction — two concurrent requests can both pass — which is
 * acceptable here precisely because the meters it guards are reconciled from
 * the underlying data. Use `consumeQuota` where the count is the only record.
 */
export async function checkQuota(req: QuotaRequest): Promise<void> {
  const mode = getEntitlementsMode();
  if (mode === 'off') return;

  const limit = req.entitlements.limits.meters[req.meter] ?? UNLIMITED;
  if (limit === UNLIMITED) return;

  const used = await getUsage(req.subjectId, req.meter);
  if (fitsWithin(limit, used, req.amount ?? 1)) return;

  if (mode === 'observe') {
    logWouldBlock(req, used, limit);
    return;
  }
  throw quotaError(req, used, limit);
}

/**
 * Atomically reserve capacity, throwing when the reservation would overrun.
 *
 * The increment and the check are one `$inc` + read, not a read-then-write:
 * two concurrent requests that both read "24 used" against a limit of 25 would
 * both proceed and overrun. Incrementing first and rejecting on the
 * *post-increment* value means the loser of that race is the one rejected.
 *
 * A rejected reservation rolls its own increment back before throwing — unlike
 * the provider-quota version this generalizes, where an over-limit count just
 * sits there until the day rolls over. A per-user cumulative meter never rolls
 * over, so a leaked increment is permanent and shows up months later as a user
 * who cannot upload despite being well under their limit.
 */
export async function consumeQuota(req: QuotaRequest): Promise<void> {
  const mode = getEntitlementsMode();
  if (mode === 'off') return;

  const amount = req.amount ?? 1;
  const limit = req.entitlements.limits.meters[req.meter] ?? UNLIMITED;
  const period = currentPeriod(req.meter);
  const subjectId = req.subjectId.toLowerCase();

  const usage = await UsageMeter.findOneAndUpdate(
    { subjectId, meter: req.meter, period },
    { $inc: { count: amount } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  if (limit === UNLIMITED || usage.count <= limit) return;

  const usedBefore = usage.count - amount;

  if (mode === 'observe') {
    // Keep the increment: observe mode exists to measure real demand, and a
    // rolled-back count would under-report exactly the users who matter.
    logWouldBlock(req, usedBefore, limit);
    return;
  }

  await releaseQuota(subjectId, req.meter, amount);
  throw quotaError(req, usedBefore, limit);
}

/**
 * Hand back capacity after a failure that never consumed it (the upload errored,
 * the AI service refused the job), and on deletes — a cumulative meter that only
 * counts up is a bug that surfaces as an angry support email six months in.
 *
 * Never drops below zero, and never throws: a failed release must not turn a
 * recoverable error into a 500 for the caller that was already unwinding.
 */
export async function releaseQuota(
  subjectId: string,
  meter: MeterKey,
  amount = 1,
  now?: Date
): Promise<void> {
  try {
    const filter = { subjectId: subjectId.toLowerCase(), meter, period: currentPeriod(meter, now) };

    // Conditional `$inc` rather than read-then-write: a read-modify-write here
    // loses concurrent releases, which on a cumulative meter is permanent drift.
    const result = await UsageMeter.updateOne({ ...filter, count: { $gte: amount } }, { $inc: { count: -amount } });
    if (result.matchedCount === 0) {
      // Either no counter exists, or it holds less than we are handing back
      // (a reconciliation reset it in between). Clamp at zero, never negative.
      await UsageMeter.updateOne({ ...filter, count: { $lt: amount } }, { $set: { count: 0 } });
    }
  } catch (err) {
    logger.warn('Failed to release usage quota', {
      subjectId,
      meter,
      amount,
      error: (err as Error)?.message
    });
  }
}

/**
 * Set a meter to a known value. For the backfill (existing storage has to be
 * seeded or every current user starts at zero and silently exceeds later) and
 * for periodic reconciliation against the source of truth.
 */
export async function setUsage(
  subjectId: string,
  meter: MeterKey,
  count: number,
  now?: Date
): Promise<void> {
  await UsageMeter.updateOne(
    { subjectId: subjectId.toLowerCase(), meter, period: currentPeriod(meter, now) },
    { $set: { count: Math.max(0, Math.floor(count)) } },
    { upsert: true, setDefaultsOnInsert: true }
  );
}
