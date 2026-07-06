import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * Client for the public-service. These endpoints are unauthenticated, so there
 * is no onUnauthorized redirect; createApiClient still attaches correlation/
 * session headers and structured error handling.
 */
export const publicApi = createApiClient({
  baseUrl: () => getGlobalConfig().PUBLIC_API_URL!
});
