import { createHealthCheck } from '@tumbaland/backend-core';

/**
 * Health check endpoint with database connectivity.
 * Built on the shared backend-core factory so the DB-aware response contract
 * stays identical across services.
 */
export const healthCheck = createHealthCheck({
  service: 'album-service',
  description: 'Photo album management service'
});
