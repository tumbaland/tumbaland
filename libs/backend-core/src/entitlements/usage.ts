import logger from '../logging/logger';
import { PaymentRequiredError } from '../errors/HttpError';
import { UsageMeter, currentPeriod } from './UsageMeter';
import { MeterKey, METER_KEYS, UNLIMITED, fitsWithin } from './definitions';
import { Entitlements } from './types';

export interface QuotaRequest {
  /** Who the usage is billed to — see `IUsageMeter.subjectId`. */
  subjectId: string;
  meter: MeterKey;
  /** How much this request wants. Bytes for `storageBytes`, otherwise a count. */
  amount?: number;
  entitlements: Entitlements;
  /** Attached to the rejection log so a 402 can be traced back to a route. */
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

/**
 * Every rejection is logged, not just thrown. The 402 reaches the user, but
 * only this line reaches the operator — and the two questions worth asking of a
 * paywall (which meter fires most, and how often it fires on a *stale* fallback
 * rather than on real limits) are answerable from nothing else.
 */
function logBlocked(req: QuotaRequest, used: number, limit: number): void {
  logger.info('entitlement.blocked', {
    event: 'entitlement.blocked',
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
  const limit = req.entitlements.limits.meters[req.meter] ?? UNLIMITED;
  if (limit === UNLIMITED) return;

  const used = await getUsage(req.subjectId, req.meter);
  if (fitsWithin(limit, used, req.amount ?? 1)) return;

  logBlocked(req, used, limit);
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

  logBlocked(req, usedBefore, limit);
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

/**
 * Record usage that has already happened, without a limit check.
 *
 * The storage gate runs on the *signed-URL request* — the only point where a
 * file's size is known before its bytes are written — so by the time the photo
 * record is created the object is already in MinIO. Neither of the existing
 * primitives fits that moment: `checkQuota` records nothing, and `consumeQuota`
 * would reject and roll back, leaving the meter understating bytes that are
 * genuinely stored while the user is refused a record for storage they have
 * already paid for.
 *
 * So this increments past the limit deliberately. A cumulative meter can only
 * be pushed over by a race or a stale entitlement, both bounded by one upload,
 * and the gate then refuses the *next* one — which is the correct behaviour:
 * the ceiling stops new writes, it does not un-store bytes.
 *
 * Never throws, for the same reason `releaseQuota` does not: the resource
 * exists, the caller is on its success path, and a failed counter update is
 * repaired by the nightly reconciliation this meter is derived for.
 */
export async function recordUsage(
  subjectId: string,
  meter: MeterKey,
  amount = 1,
  now?: Date
): Promise<void> {
  if (amount <= 0) return;

  try {
    await UsageMeter.updateOne(
      { subjectId: subjectId.toLowerCase(), meter, period: currentPeriod(meter, now) },
      { $inc: { count: amount } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    logger.warn('Failed to record usage', {
      subjectId,
      meter,
      amount,
      error: (err as Error)?.message
    });
  }
}
