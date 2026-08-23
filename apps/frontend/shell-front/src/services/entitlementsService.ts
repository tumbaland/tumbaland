import { createEntitlementsService } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * The signed-in user's own plan, limits and live usage, for the home page's
 * plan card.
 *
 * No `onUnauthorized`: a failed lookup hides the card rather than bouncing
 * anyone to the login screen. The home page is behind auth already, and a
 * usage panel is the last thing that should be allowed to log a user out.
 */
export const { getMyEntitlements } = createEntitlementsService({
  getPaymentApiUrl: () => getGlobalConfig().PAYMENT_API_URL!
});
