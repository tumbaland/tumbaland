/**
 * Plan and limit definitions rendered by the landing page.
 *
 * INTERIM SOURCE — see MONETIZATION.md §1.1. This file exists so the landing
 * page has something to render before the entitlement backbone lands. Once
 * `@tumbaland/backend-core/entitlements` ships its `PLAN_LIMITS` definition,
 * this module must be deleted and both this page and payment-front's
 * `PlansPage` must read that instead. Two hand-maintained copies of the limits
 * is exactly the failure this plan is fixing — `PlansPage`'s hardcoded
 * `featureMatrix` advertised six limits that no service ever enforced.
 *
 * Until `ENTITLEMENTS_MODE=enforce` is live, `PRICING_STATUS` stays 'preview'
 * and the page says so. Do not flip it to 'live' before the meters actually
 * meter — advertising limits you don't enforce is the liability, not the gap.
 */

export type PlanCode = 'free' | 'personal' | 'family';

export type BillingInterval = 'month' | 'year';

/** Flip to 'live' only when MONETIZATION.md Phase 4 has shipped. */
export const PRICING_STATUS: 'preview' | 'live' = 'preview';

export interface Plan {
  code: PlanCode;
  name: string;
  tagline: string;
  /** Cents, so there is never a float in a price. */
  priceMonthlyCents: number;
  priceYearlyCents: number;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    code: 'free',
    name: 'Free',
    tagline: 'Everything, at a smaller scale. No card, no expiry.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0
  },
  {
    code: 'personal',
    name: 'Personal',
    tagline: 'Full history and the portfolio planner, for one person.',
    priceMonthlyCents: 600,
    priceYearlyCents: 6000,
    highlight: true
  },
  {
    code: 'family',
    name: 'Family',
    tagline: 'The same, shared across a household of up to five.',
    priceMonthlyCents: 1200,
    priceYearlyCents: 12000
  }
];

export interface LimitRow {
  key: string;
  label: string;
  /**
   * Display-ready phrase per plan. Written as what the tier *has*, never as a
   * dash — a column of "—" makes the free tier read as a crippled version of
   * the product rather than a usable one. `null` omits the line entirely.
   */
  values: Record<PlanCode, string | null>;
  /**
   * True when the limit is published but not yet enforceable. AI jobs have no
   * server-side dispatch path to meter (MONETIZATION.md §3.1), so the page
   * badges it rather than quoting a number it cannot hold itself to.
   */
  comingSoon?: boolean;
}

export const LIMIT_ROWS: LimitRow[] = [
  {
    key: 'storage',
    label: 'Photo storage',
    values: { free: '1 GB photos', personal: '50 GB photos', family: '250 GB shared photos' }
  },
  {
    key: 'history',
    label: 'History',
    values: { free: '90 days of history', personal: 'Full history', family: 'Full history' }
  },
  {
    key: 'tickers',
    label: 'Tracked tickers',
    values: { free: '3 tracked tickers', personal: '25 tracked tickers', family: '100 tracked tickers' }
  },
  {
    key: 'planner',
    label: 'Portfolio planner',
    values: { free: null, personal: 'Portfolio planner', family: 'Portfolio planner' }
  },
  {
    key: 'seats',
    label: 'People',
    values: { free: '1 person', personal: '1 person', family: 'Up to 5 people' }
  },
  {
    key: 'export',
    label: 'Collage export',
    values: {
      free: 'Collage export, watermarked',
      personal: 'Full-res collage export',
      family: 'Full-res collage export'
    }
  },
  {
    key: 'ai',
    label: 'AI photo analysis',
    values: { free: '25 AI photo scans', personal: '200 AI scans a month', family: '600 AI scans a month' },
    comingSoon: true
  }
];

export function formatPrice(cents: number): string {
  if (cents === 0) return '€0';
  return `€${(cents / 100).toFixed(0)}`;
}

export function priceFor(plan: Plan, interval: BillingInterval): number {
  return interval === 'month' ? plan.priceMonthlyCents : plan.priceYearlyCents;
}

/** Months of a monthly plan you'd pay for if you bought a year up front. */
export function yearlySavingMonths(plan: Plan): number {
  if (plan.priceMonthlyCents === 0) return 0;
  const fullYear = plan.priceMonthlyCents * 12;
  return Math.round((fullYear - plan.priceYearlyCents) / plan.priceMonthlyCents);
}
