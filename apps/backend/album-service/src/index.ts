import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const PORT = process.env.PORT || 4002;

// Connect before binding the port: a service that can't reach MongoDB has
// nothing to serve, and listening anyway would pass the health check while
// failing every request. Exiting hands recovery to the container restart policy.
const start = async (): Promise<void> => {
  await connectDB('album-service');

  const server = app.listen(PORT, () => logger.info('Album service started successfully', { port: PORT }));

  // Graceful shutdown (SIGINT + SIGTERM: end the collage streams, drain HTTP,
  // then close the DB)
  registerShutdown({ serviceName: 'album-service', server });
};

start().catch((error: Error) => {
  logger.error('Failed to start album-service', { error: error.message, stack: error.stack });
  process.exit(1);
});
