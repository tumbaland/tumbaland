import { requireInternalServiceToken } from '@tumbaland/backend-core';

/**
 * Strictly requires a valid internal-service token — invalidate-tokens is only
 * ever called service-to-service, so a missing or mismatched token is always
 * rejected rather than falling through to normal auth.
 *
 * The implementation moved to `@tumbaland/backend-core` when payment-service's
 * entitlement endpoint needed the same gate; it now compares in constant time.
 * This name is kept for the routes that already import it.
 */
export const requireInternalService = requireInternalServiceToken;
