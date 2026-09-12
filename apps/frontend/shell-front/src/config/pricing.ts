/**
 * Presentation for the support section. **No limits, and no prices.**
 *
 * Those come from `GET /api/plans`, already resolved by the same
 * `normalizeLimits` the entitlement middleware enforces from, so the ceiling on
 * a card and the ceiling that produces a 402 are one value read from one place.
 * This file used to hold both, and shipping that at the moment money changes
 * hands would have recreated the Phase 0 defect with a payment attached —
 * `PlansPage` advertised six limits no service enforced.
 *
 * What stays here is what is genuinely presentation: a plan's tagline, which
 * card is highlighted, how a number becomes a sentence, and — importantly —
 * *which* limits may be advertised at all.
 */

import { CatalogPlan, PlanLimits, UNLIMITED, isUnlimited } from '@tumbaland/frontend-core';

export type BillingInterval = 'month' | 'year';

/**
 * Paid checkout is closed: no plan carries a `stripePriceId` yet, so a priced
 * plan 503s at checkout, and the section says so rather than letting someone
 * click into a dead end. Flip to 'live' when the Stripe prices are set
 * (MONETIZATION.md, Tier 0).
 */
export const PRICING_STATUS: 'preview' | 'live' = 'preview';

/**
 * Copy for the plans we ship. Keyed by code and *optional*: a plan an admin
 * adds later renders from its own `description`, so the catalog is never
 * gated on a frontend deploy.
 */
interface PlanCopy {
  tagline: string;
  highlight?: boolean;
}

/**
 * Two plans, and `highlight` is on **free**.
 *
 * `personal` and `family` were consolidated into one `support` tier. Two paid
 * columns ask a visitor to work out which edition of the product they are
 * entitled to, which is a question a business asks; one tier that grants
 * everything leaves only the question actually being asked, which is whether
 * they want to chip in. The badge sits on free for the same reason — on the
 * dearest card it read as "the free column is the sample".
 */
export const PLAN_COPY: Record<string, PlanCopy> = {
  free: { tagline: 'Everything the app does, at a personal scale. No card, no expiry.', highlight: true },
  support: { tagline: 'The same app with far more room, and you help keep it running.' }
};

export function taglineFor(plan: CatalogPlan): string {
  return PLAN_COPY[plan.code]?.tagline ?? plan.description ?? '';
}

export function isHighlighted(plan: CatalogPlan): boolean {
  return PLAN_COPY[plan.code]?.highlight === true;
}

export interface LimitLine {
  key: string;
  /** Display-ready phrase. Written as what the tier *has*, never as a dash. */
  text: string;
}

function formatBytes(bytes: number): string {
  if (isUnlimited(bytes)) return 'Unlimited';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Number(gb.toFixed(gb < 10 ? 1 : 0))} GB`;
  const mb = bytes / 1024 ** 2;
  return `${Math.round(mb)} MB`;
}

/**
 * The limit lines for one plan's card, derived from what the plan actually
 * grants.
 *
 * **Two enforced-elsewhere rules decide what is *absent* here**, and both are
 * deliberate omissions rather than oversights:
 *
 * - `aiJobs` is not advertised. The AI photo analysis it was defined for has
 *   been removed, so the meter counts nothing and a number on the card would be
 *   a claim nothing holds the product to.
 * - `cleanExport` is not advertised. Collage export is entirely client-side and
 *   no watermarking code exists (3.0), so the free tier's "watermarked" line
 *   described something that never happened. It returns the moment its
 *   chokepoint lands; advertising it meanwhile is the part with legal exposure,
 *   not the missing feature.
 */
export function limitLinesFor(limits: PlanLimits): LimitLine[] {
  const lines: LimitLine[] = [];
  const { meters, retentionDays } = limits;
  const pooled = meters.seats > 1 || isUnlimited(meters.seats);

  lines.push({
    key: 'storage',
    text: `${formatBytes(meters.storageBytes)} ${pooled ? 'shared photos' : 'photos'}`
  });

  lines.push({
    key: 'history',
    text: isUnlimited(retentionDays) ? 'Full history' : `${retentionDays} days of history`
  });

  lines.push({
    key: 'tickers',
    text: isUnlimited(meters.trackedTickers)
      ? 'Unlimited tracked tickers'
      : `${meters.trackedTickers} tracked tickers`
  });

  // The planner needs roughly two years of daily closes to estimate a
  // covariance, so retention *is* the planner gate — one meter, two products.
  // Deriving the line from `retentionDays` keeps the card honest if that
  // number is ever edited at runtime.
  if (isUnlimited(retentionDays)) {
    lines.push({ key: 'planner', text: 'Portfolio planner' });
  }

  lines.push({
    key: 'seats',
    text: isUnlimited(meters.seats)
      ? 'Unlimited people'
      : meters.seats === 1
        ? '1 person'
        : `Up to ${meters.seats} people`
  });

  return lines;
}

export function formatPrice(cents: number): string {
  if (cents === 0) return '€0';
  return `€${(cents / 100).toFixed(0)}`;
}

export function priceFor(plan: CatalogPlan, interval: BillingInterval): number {
  return interval === 'month' ? plan.priceMonthlyCents : (plan.priceYearlyCents ?? 0);
}

/** Months of a monthly plan you'd pay for if you bought a year up front. */
export function yearlySavingMonths(plan: CatalogPlan): number {
  if (!plan.priceMonthlyCents || !plan.priceYearlyCents) return 0;
  const fullYear = plan.priceMonthlyCents * 12;
  return Math.round((fullYear - plan.priceYearlyCents) / plan.priceMonthlyCents);
}

/** True when a plan has a yearly price worth offering a toggle for. */
export function hasYearlyPricing(plans: CatalogPlan[]): boolean {
  return plans.some(plan => (plan.priceYearlyCents ?? 0) > 0);
}

export { UNLIMITED, isUnlimited };
export type { CatalogPlan, PlanLimits };
