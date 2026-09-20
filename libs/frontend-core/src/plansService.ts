import { createApiClient } from './apiClient';
import { PlanLimits } from './entitlementsService';

/**
 * The public plan catalog, as the pricing page renders it.
 *
 * **The numbers are never duplicated here.** `effectiveLimits` arrives from the
 * API already resolved by the same `normalizeLimits` the entitlement middleware
 * enforces from, so the ceiling on the card and the ceiling that produces a 402
 * are the same value read from the same place. A hardcoded pricing table is the
 * exact defect Phase 0 removed — `PlansPage` advertised six limits no service
 * enforced — and re-creating it at the moment money changes hands would attach
 * a payment to the claim.
 *
 * What a front *may* own is copy: a plan's tagline and which card is
 * highlighted are presentation, not entitlement.
 */

export interface CatalogPlan {
  code: string;
  name: string;
  /** Admin-editable tagline. Absent on plans nobody has written copy for. */
  description?: string;
  /** Cents, so there is never a float in a price. */
  priceMonthlyCents: number;
  priceYearlyCents?: number;
  /** Marketing bullets. Deliberately unused by the limit rows — see above. */
  features?: string[];
  isPublic?: boolean;
  /** Whether the plan can be bought at all; a priced plan without one returns 503 at checkout. */
  stripePriceId?: string;
  /** Limits after code defaults fill whatever the plan document leaves unset. */
  effectiveLimits: PlanLimits;
}

export interface PlansServiceConfig {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  getPaymentApiUrl: () => string;
}

interface PlansResponse {
  success?: boolean;
  plans?: CatalogPlan[];
}

/**
 * Builds a per-front plans service.
 *
 *   export const { getPlans } = createPlansService({
 *     getPaymentApiUrl: () => getGlobalConfig().PAYMENT_API_URL!
 *   });
 *
 * `GET /api/plans` is optionally authenticated: a signed-out visitor gets the
 * public catalog, and a signed-in one additionally gets the hidden plan they
 * are actually on. No `onUnauthorized` redirect, therefore — the landing page
 * is reachable without an account and must stay that way.
 */
export function createPlansService(config: PlansServiceConfig) {
  const client = createApiClient({ baseUrl: () => config.getPaymentApiUrl() });

  return {
    async getPlans(): Promise<CatalogPlan[]> {
      const body = await client.get<PlansResponse>('/api/plans');
      const plans = body?.plans ?? [];

      // A plan without resolved limits cannot be rendered honestly — every line
      // on its card is a limit — so drop it rather than draw a card with holes.
      return plans.filter((plan) => Boolean(plan?.effectiveLimits?.meters));
    }
  };
}

export type PlansService = ReturnType<typeof createPlansService>;
