/**
 * The entitlement *vocabulary*: which meters and features exist, what they
 * mean, and what a plan gets when nothing else says otherwise.
 *
 * The actual per-plan numbers are NOT here — they live on the `Plan` document
 * in Mongo and are editable by an admin at runtime (see payment-service's
 * `Plan.limits` and `PUT /api/plans/:code/limits`). Shipping a code change to
 * move a limit from 50 GB to 75 GB would be absurd, and a hardcoded table
 * would immediately drift from what the pricing page renders.
 *
 * What code still owns:
 *   - the set of valid keys, so a typo in an admin form can't invent a meter
 *     that nothing enforces (`normalizeLimits` drops unknown keys);
 *   - `DEFAULT_PLAN_LIMITS`, the values used when a Plan document has no
 *     `limits` yet (fresh install, newly created plan) or when payment-service
 *     is unreachable and the client has to fail closed;
 *   - `ENTITLEMENT_CATALOG`, the metadata an admin UI renders its form from,
 *     so adding a meter needs no frontend change.
 */

export type MeterKey = 'storageBytes' | 'aiJobs' | 'trackedTickers' | 'seats';

/**
 * Deliberately small. The portfolio planner is NOT a feature flag — it is gated
 * by `retentionDays` via the price-history range, because the planner runs
 * entirely client-side and a boolean flag would be bypassable from devtools.
 */
export type FeatureKey = 'cleanExport';

/** `ALL` = counts up forever (storage, seats). `MONTH` = resets each calendar month (UTC). */
export type MeterPeriod = 'ALL' | 'MONTH';

/** Sentinel for "no ceiling". Chosen over `Infinity` because it survives JSON and BSON. */
export const UNLIMITED = -1;

export interface MeterDefinition {
  key: MeterKey;
  label: string;
  /** Drives formatting in the admin form and in `<UsageMeter>`: bytes get humanized, counts don't. */
  unit: 'bytes' | 'count';
  period: MeterPeriod;
  description: string;
}

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
}

export const METER_DEFINITIONS: readonly MeterDefinition[] = [
  {
    key: 'storageBytes',
    label: 'Storage',
    unit: 'bytes',
    period: 'ALL',
    description: 'Total bytes of uploaded photos and files held for the user.'
  },
  {
    key: 'aiJobs',
    label: 'AI analyses',
    unit: 'count',
    period: 'MONTH',
    description: 'Segmentation and object-detection jobs dispatched per calendar month.'
  },
  {
    key: 'trackedTickers',
    label: 'Tracked tickers',
    unit: 'count',
    period: 'ALL',
    description: 'Instruments followed for price history. Each one spends the deployment-wide market-data budget.'
  },
  {
    key: 'seats',
    label: 'Group seats',
    unit: 'count',
    period: 'ALL',
    description: 'Members that may join groups owned by the user, including the owner.'
  }
] as const;

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    key: 'cleanExport',
    label: 'Clean export',
    description: 'Exports and downloads without a watermark.'
  }
] as const;

export const METER_KEYS: readonly MeterKey[] = METER_DEFINITIONS.map(m => m.key);
export const FEATURE_KEYS: readonly FeatureKey[] = FEATURE_DEFINITIONS.map(f => f.key);

const METER_PERIODS = Object.fromEntries(
  METER_DEFINITIONS.map(m => [m.key, m.period])
) as Record<MeterKey, MeterPeriod>;

export function meterPeriod(meter: MeterKey): MeterPeriod {
  return METER_PERIODS[meter] ?? 'ALL';
}

export function isMeterKey(value: string): value is MeterKey {
  return (METER_KEYS as readonly string[]).includes(value);
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export interface PlanLimits {
  /** `-1` (UNLIMITED) means no ceiling. */
  meters: Record<MeterKey, number>;
  features: Record<FeatureKey, boolean>;
  /** How far back reads may reach. `-1` (UNLIMITED) means the full history. */
  retentionDays: number;
}

/** What an admin form or an API caller may send: any subset, in any order. */
export interface PartialPlanLimits {
  meters?: Partial<Record<string, number>>;
  features?: Partial<Record<string, boolean>>;
  retentionDays?: number;
}

const GB = 1024 * 1024 * 1024;

/**
 * Bootstrap values only — a Plan document's own `limits` wins over anything
 * here. These are what a plan gets before an admin has ever touched it, and
 * what the entitlement client falls back to when payment-service is down.
 *
 * Keep `free` conservative for exactly that reason: an outage degrades paying
 * users to these numbers, and the alternative (fail-open) gives the product
 * away for the length of the outage.
 */
export const DEFAULT_PLAN_LIMITS: Readonly<Record<string, PlanLimits>> = {
  free: {
    meters: { storageBytes: 1 * GB, aiJobs: 25, trackedTickers: 3, seats: 1 },
    features: { cleanExport: false },
    retentionDays: 90
  },
  personal: {
    meters: { storageBytes: 50 * GB, aiJobs: 200, trackedTickers: 25, seats: 1 },
    features: { cleanExport: true },
    retentionDays: UNLIMITED
  },
  family: {
    meters: { storageBytes: 250 * GB, aiJobs: 600, trackedTickers: 100, seats: 5 },
    features: { cleanExport: true },
    retentionDays: UNLIMITED
  },
  /**
   * Everything unlimited, for the maintainers and for comped friends. Held as a
   * real plan with a real subscription rather than an exemption branch in the
   * code, so the people running the product go through the identical
   * enforcement path as a paying customer — an `if (isStaff) skipEverything`
   * flag would mean the paywall is never exercised by anyone who could notice
   * it was broken.
   *
   * Kept off the public catalog through `Plan.isPublic = false`.
   */
  staff: {
    meters: { storageBytes: UNLIMITED, aiJobs: UNLIMITED, trackedTickers: UNLIMITED, seats: UNLIMITED },
    features: { cleanExport: true },
    retentionDays: UNLIMITED
  }
};

/** Plan code the seeded staff/comp plan uses. */
export const STAFF_PLAN = 'staff';

export const FALLBACK_PLAN = 'free';

/**
 * Code defaults for a plan code, with unknown codes resolving to free.
 *
 * That fallback is deliberate: a typo'd or newly-added plan code must never
 * silently grant unlimited. Callers that want the admin-configured numbers
 * read them from the Plan document and pass them through `normalizeLimits`;
 * this function is the floor underneath that.
 */
export function resolveLimits(planCode?: string): PlanLimits {
  const limits = DEFAULT_PLAN_LIMITS[planCode ?? FALLBACK_PLAN] ?? DEFAULT_PLAN_LIMITS[FALLBACK_PLAN];
  return cloneLimits(limits);
}

function cloneLimits(limits: PlanLimits): PlanLimits {
  return {
    meters: { ...limits.meters },
    features: { ...limits.features },
    retentionDays: limits.retentionDays
  };
}

function normalizeCeiling(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  // Anything negative means "unlimited"; nothing else is a meaningful ceiling.
  if (value < 0) return UNLIMITED;
  return Math.floor(value);
}

/**
 * Layers a partial set of limits over a complete one.
 *
 * Entitlements resolve through three layers, each one partial and each one
 * overriding the last: code defaults → the Plan document's `limits` → a
 * per-user `EntitlementOverride`. This is the single step all three share.
 *
 * - unknown meter/feature keys are dropped — no store can invent enforcement;
 * - missing keys keep the base value, so adding a new meter in code works
 *   everywhere before any stored document mentions it;
 * - negative numbers normalize to `UNLIMITED`, fractions floor.
 */
export function applyLimits(base: PlanLimits, input?: PartialPlanLimits | null): PlanLimits {
  const result = cloneLimits(base);
  if (!input) return result;

  for (const key of METER_KEYS) {
    result.meters[key] = normalizeCeiling(input.meters?.[key], result.meters[key]);
  }
  for (const key of FEATURE_KEYS) {
    const value = input.features?.[key];
    result.features[key] = typeof value === 'boolean' ? value : result.features[key];
  }
  result.retentionDays = normalizeCeiling(input.retentionDays, result.retentionDays);

  return result;
}

/**
 * Turns whatever is stored on a Plan document (or arrived from an admin form)
 * into a complete, valid `PlanLimits`, filling the gaps from that plan code's
 * code defaults.
 */
export function normalizeLimits(input?: PartialPlanLimits | null, planCode?: string): PlanLimits {
  return applyLimits(resolveLimits(planCode), input);
}

/** True when `used + amount` fits under `limit`. `UNLIMITED` always fits. */
export function fitsWithin(limit: number, used: number, amount = 0): boolean {
  if (limit === UNLIMITED || limit < 0) return true;
  return used + amount <= limit;
}

/**
 * Everything an admin UI needs to render a limits editor without hardcoding a
 * single meter name — new keys appear in the form as soon as they exist here.
 */
export const ENTITLEMENT_CATALOG = {
  unlimited: UNLIMITED,
  meters: METER_DEFINITIONS,
  features: FEATURE_DEFINITIONS,
  retentionDays: {
    key: 'retentionDays' as const,
    label: 'History retention (days)',
    unit: 'days' as const,
    description:
      'How far back reads may reach. Gates relationship history and, through the price-history range, the portfolio planner.'
  },
  defaults: DEFAULT_PLAN_LIMITS,
  fallbackPlan: FALLBACK_PLAN
};
