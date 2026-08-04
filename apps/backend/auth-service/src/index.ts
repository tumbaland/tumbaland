import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if required secrets are missing — tokens must never be signed with a
// default, and the internal-service endpoint must never accept an unset token.
requireEnv('JWT_SECRET');
requireEnv('INTERNAL_SERVICE_TOKEN');

const PORT = process.env.PORT || 5001;

// Connect before binding the port: a service that can't reach MongoDB has
// nothing to serve, and listening anyway would pass the health check while
// failing every request. Exiting hands recovery to the container restart policy.
const start = async (): Promise<void> => {
  await connectDB('auth-service');

  const server = app.listen(PORT, () =>
    logger.info('Auth service started successfully', { port: PORT })
  );

  // Graceful shutdown (SIGINT + SIGTERM: drain HTTP, then close the DB)
  registerShutdown({ serviceName: 'auth-service', server });
};

start().catch((error: Error) => {
  logger.error('Failed to start auth-service', { error: error.message, stack: error.stack });
  process.exit(1);
});
