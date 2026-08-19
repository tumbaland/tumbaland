import { createPlansService } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * The public plan catalog for the landing page.
 *
 * `GET /api/plans` is optionally authenticated, so this works for a signed-out
 * visitor — which is the only kind the landing page has — and a signed-in one
 * additionally gets the hidden plan they are on.
 */
export const { getPlans } = createPlansService({
  getPaymentApiUrl: () => getGlobalConfig().PAYMENT_API_URL!
});
