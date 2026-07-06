import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from './ConfigProvider';

/**
 * Authenticated client for the relationship-service. Methods return the parsed
 * JSON body directly (e.g. the backend's `ApiResponse<T>` envelope) — no
 * axios-style `{ data }` wrapper.
 */
export const relationshipApi = createApiClient({
  baseUrl: () => `${getGlobalConfig().RELATIONSHIP_API_URL}/api`,
  onUnauthorized: () => {
    const { AUTH_FRONT_URL } = getGlobalConfig();
    if (AUTH_FRONT_URL) {
      window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }
});

export default relationshipApi;
