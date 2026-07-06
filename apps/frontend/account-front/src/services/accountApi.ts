import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * Authenticated client for the auth-service endpoints account-front talks to
 * (profile updates, etc.). Auth transport is the httpOnly access_token cookie,
 * attached automatically via credentials: 'include' inside createApiClient.
 */
export const accountApi = createApiClient({
  baseUrl: () => getGlobalConfig().AUTH_SERVICE_URL!,
  onUnauthorized: () => {
    const { AUTH_FRONT_URL } = getGlobalConfig();
    if (AUTH_FRONT_URL) {
      window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }
});
