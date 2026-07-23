import { createHealthCheck } from '@tumbaland/backend-core';

/**
 * Health check endpoint. public-service has no database, so readiness is a
 * static ok — built on the shared factory with the DB check disabled.
 */
export const healthCheck = createHealthCheck({
  service: 'public-service',
  description: 'Public API endpoints service',
  checkDatabase: false
});
