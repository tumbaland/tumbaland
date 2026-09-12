/**
 * Turns a 402 into a sentence that names the limit that was hit.
 *
 * Enforcement lands before the shared `<UpgradeDialog>` of MONETIZATION.md 4.2
 * does, and "Failed to save ticker" for a plan limit reads as a bug rather than
 * a price — which is the one failure mode the phase is meant to avoid. Until
 * the dialog exists, the 402 body says everything the user needs, so this
 * renders it into the snackbar the tabs already have.
 *
 * Anything that is not a 402 keeps the caller's own message: a network blip and
 * a paywall must not read the same.
 */

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

export function paywallMessage(err: unknown, fallback: string): string {
  if (!isPaymentRequired(err)) return fallback;

  const body = ((err as { body?: PaymentRequiredBody }).body ?? {}) as PaymentRequiredBody;
  const what = body.meter ? `the ${METER_LABELS[body.meter] ?? body.meter} limit` : 'a plan limit';
  const ceiling = typeof body.limit === 'number' ? ` (${body.limit})` : '';
  const upgrade = body.upgradeTo ? ` Upgrade to ${body.upgradeTo} for more.` : '';

  return `You have reached ${what}${ceiling} on your ${body.planCode ?? 'current'} plan.${upgrade}`;
}
