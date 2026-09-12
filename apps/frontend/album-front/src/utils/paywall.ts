/**
 * Turns a 402 into a sentence that names the limit that was hit.
 *
 * Enforcement lands before the shared `<UpgradeDialog>` of MONETIZATION.md 4.2
 * does, and "Failed to upload photo.jpg" for a plan limit reads as a bug rather
 * than a price — which is the one failure mode the phase is meant to avoid.
 * Until the dialog exists, the 402 body says everything the user needs, so this
 * renders it into the error alert the upload dialog already has.
 *
 * Anything that is not a 402 keeps the caller's own message: a network blip and
 * a paywall must not read the same.
 *
 * A copy of finance-front's, deliberately: the two fronts cannot import from
 * each other, and `@tumbaland/components` is presentational — this belongs in
 * `<UpgradeDialog>` when that lands, which is when both copies go away.
 */

import { formatBytes } from './formatBytes';

interface PaymentRequiredBody {
  code?: string;
  meter?: string;
  used?: number;
  limit?: number;
  planCode?: string;
  upgradeTo?: string;
  message?: string;
}

/** What each meter is called in a sentence. Falls back to the raw key. */
const METER_LABELS: Record<string, string> = {
  storageBytes: 'storage',
  trackedTickers: 'tracked tickers',
  seats: 'group seats'
};

export function isPaymentRequired(err: unknown): boolean {
  return (err as { status?: number })?.status === 402;
}

/**
 * `storageBytes` is the one meter whose raw number is unreadable — "1073741824"
 * tells a user nothing, and a limit they cannot read is a limit they cannot
 * decide about.
 */
function formatCeiling(meter: string | undefined, limit: number): string {
  return meter === 'storageBytes' ? formatBytes(limit) : String(limit);
}

export function paywallMessage(err: unknown, fallback: string): string {
  if (!isPaymentRequired(err)) return fallback;

  const body = ((err as { body?: PaymentRequiredBody }).body ?? {}) as PaymentRequiredBody;
  const what = body.meter ? `the ${METER_LABELS[body.meter] ?? body.meter} limit` : 'a plan limit';
  const ceiling = typeof body.limit === 'number' ? ` (${formatCeiling(body.meter, body.limit)})` : '';
  const upgrade = body.upgradeTo ? ` Upgrade to ${body.upgradeTo} for more.` : '';

  return `You have reached ${what}${ceiling} on your ${body.planCode ?? 'current'} plan.${upgrade}`;
}
