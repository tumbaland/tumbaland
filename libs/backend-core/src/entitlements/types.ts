import { PlanLimits } from './definitions';

/**
 * What payment-service answers for a user, and what the client caches.
 * `limits` is already normalized — consumers never merge defaults themselves.
 */
export interface Entitlements {
  email: string;
  planCode: string;
  /** Subscription status backing the plan; `null` for users on the implicit free plan. */
  status: string | null;
  limits: PlanLimits;
  /** Cheapest active plan priced above the current one, for the upgrade dialog's CTA. */
  upgradeTo?: string;
  /**
   * Set when payment-service could not be reached and these are fallback
   * limits rather than the user's real ones. Enforcement still applies (fail
   * closed), but the value lets callers log the difference.
   */
  stale?: boolean;
}
