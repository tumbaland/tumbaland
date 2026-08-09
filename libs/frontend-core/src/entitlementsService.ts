import { createApiClient } from './apiClient';

/**
 * The caller's own plan, limits and live meter readings.
 *
 * **The vocabulary is duplicated from `@tumbaland/backend-core`; the numbers
 * never are.** A browser bundle cannot import backend-core — it pulls in
 * mongoose — so the meter *keys* are restated here. That is a deliberate line:
 * duplicating the key names costs a rename, while duplicating the limits would
 * recreate exactly the defect Phase 0 removed, where `PlansPage` advertised six
 * ceilings that no service enforced. Every number below arrives from the API at
 * runtime, resolved by the same `normalizeLimits` the middleware enforces from.
 */
export type MeterKey = 'storageBytes' | 'aiJobs' | 'trackedTickers' | 'seats';

export type FeatureKey = 'cleanExport';

/** Matches `UNLIMITED` in backend-core. Chosen over `Infinity` because it survives JSON. */
export const UNLIMITED = -1;

export interface PlanLimits {
  meters: Record<MeterKey, number>;
  features: Record<FeatureKey, boolean>;
  /** How far back reads may reach. `-1` means the full history. */
  retentionDays: number;
}

export interface Entitlements {
  email: string;
  planCode: string;
  /** Subscription status backing the plan; `null` on the implicit free plan. */
  status: string | null;
  limits: PlanLimits;
  /** Cheapest active plan priced above the current one, for an upgrade CTA. */
  upgradeTo?: string;
  /** Granted by an admin rather than bought — render as "Complimentary". */
  isComp?: boolean;
  hasOverride?: boolean;
  /** Live meter readings, same keys as `limits.meters`. */
  usage: Record<MeterKey, number>;
}

export interface EntitlementsServiceConfig {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  getPaymentApiUrl: () => string;
  onUnauthorized?: () => void;
}

interface EntitlementsResponse extends Entitlements {
  success?: boolean;
}

const ZERO_USAGE: Record<MeterKey, number> = {
  storageBytes: 0,
  aiJobs: 0,
  trackedTickers: 0,
  seats: 0
};

/**
 * Builds a per-front entitlements service.
 *
 *   export const { getMyEntitlements } = createEntitlementsService({
 *     getPaymentApiUrl: () => getGlobalConfig().PAYMENT_API_URL!
 *   });
 */
export function createEntitlementsService(config: EntitlementsServiceConfig) {
  const client = createApiClient({
    baseUrl: () => config.getPaymentApiUrl(),
    onUnauthorized: config.onUnauthorized
  });

  return {
    async getMyEntitlements(): Promise<Entitlements> {
      const body = await client.get<EntitlementsResponse>('/api/subscriptions/me/entitlements');

      // Reject rather than return a half-built object. Without `limits` there
      // is no ceiling to meter against, and handing back a truthy
      // `Entitlements` whose `limits` is undefined pushes the crash into every
      // call site's property access instead of failing here, once.
      if (!body?.limits?.meters) {
        throw new Error('Entitlements response is missing limits');
      }

      return {
        ...body,
        // A meter with no counter yet is simply absent from the snapshot, which
        // would otherwise render as `undefined of 1 GB`.
        usage: { ...ZERO_USAGE, ...(body.usage ?? {}) }
      };
    }
  };
}

export type EntitlementsService = ReturnType<typeof createEntitlementsService>;

/** True when a meter has no ceiling. */
export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED || limit < 0;
}

/**
 * Share of a meter consumed, 0–1, clamped. Unlimited meters report 0 — there is
 * no ceiling to be a fraction of, and reporting 1 would paint them as full.
 */
export function usageRatio(used: number, limit: number): number {
  if (isUnlimited(limit) || limit === 0) return 0;
  return Math.min(1, Math.max(0, used / limit));
}
