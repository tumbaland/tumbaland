import { TooManyRequestsError, logger } from '@tumbaland/backend-core';
import ApiUsage from '../models/ApiUsage';

export const PROVIDER = 'alphavantage';

/**
 * Alpha Vantage's free plan allows 25 requests per day (not per minute — the
 * per-minute figure applies to paid plans). Change this constant if the
 * deployment moves to a paid key.
 */
export const DAILY_LIMIT = 25;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  date: string;
}

export async function getRemainingQuota(): Promise<QuotaStatus> {
  const date = today();
  const limit = DAILY_LIMIT;
  const usage = await ApiUsage.findOne({ provider: PROVIDER, date });
  const used = usage?.count ?? 0;

  return { limit, used, remaining: Math.max(0, limit - used), date };
}

/**
 * Reserve one call against today's quota, throwing when it is exhausted.
 *
 * The increment and the check are a single atomic `$inc` + read: two concurrent
 * requests that both read "24 used" would otherwise both proceed and overrun
 * the limit. Reserving first and rejecting on the post-increment value means a
 * loser of that race is rejected rather than silently spending a 26th call.
 */
export async function consumeQuota(): Promise<void> {
  const date = today();
  const limit = DAILY_LIMIT;

  const usage = await ApiUsage.findOneAndUpdate(
    { provider: PROVIDER, date },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );

  if (usage.count > limit) {
    throw new TooManyRequestsError(
      `Daily ${PROVIDER} quota exhausted (${limit} calls). Resets at 00:00 UTC.`
    );
  }
}

/**
 * Hand a reserved call back after a failure that never reached the provider,
 * so a bug or a network error does not permanently eat the day's quota.
 */
export async function releaseQuota(): Promise<void> {
  const date = today();
  try {
    await ApiUsage.updateOne({ provider: PROVIDER, date, count: { $gt: 0 } }, { $inc: { count: -1 } });
  } catch (err) {
    logger.warn('Failed to release API quota', { error: (err as Error)?.message });
  }
}

/** True when at least one call is still available today. */
export async function hasQuota(): Promise<boolean> {
  const { remaining } = await getRemainingQuota();
  return remaining > 0;
}
