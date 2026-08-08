import dotenv from 'dotenv';

dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');
// Same for the internal token: without it /internal/entitlements answers 500
// to every service, and each of them fails closed to free limits — a silent,
// deployment-wide downgrade of everyone who paid.
requireEnv('INTERNAL_SERVICE_TOKEN');

const PORT = process.env.PORT || 5005;

// Connect before binding the port: a service that can't reach MongoDB has
// nothing to serve, and listening anyway would pass the health check while
// failing every request. Exiting hands recovery to the container restart policy.
const start = async (): Promise<void> => {
  await connectDB('payment-service');

  const server = app.listen(PORT, () =>
    logger.info('Payment service started successfully', { port: PORT })
  );

  // Graceful shutdown (SIGINT + SIGTERM: drain HTTP, then close the DB)
  registerShutdown({ serviceName: 'payment-service', server });
};

start().catch((error: Error) => {
  logger.error('Failed to start payment-service', { error: error.message, stack: error.stack });
  process.exit(1);
});
