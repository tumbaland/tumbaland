import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * Client for the auth-service, used by the login page itself. Intentionally has
 * no onUnauthorized redirect: this *is* the auth front, so a 401 means "not
 * logged in yet" (a normal state here), not a reason to bounce elsewhere.
 */
export const authApi = createApiClient({
  baseUrl: () => getGlobalConfig().AUTH_SERVICE_URL!
});
