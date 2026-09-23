import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import app from './app';
import { closeAll as closeCollageStreams } from './collage/collageLive';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const PORT = process.env.PORT || 4002;

// Connect before binding the port: a service that can't reach MongoDB has
// nothing to serve, and listening anyway would pass the health check while
// failing every request. Exiting hands recovery to the container restart policy.
const start = async (): Promise<void> => {
  await connectDB('album-service');

  const server = app.listen(PORT, () => logger.info('Album service started successfully', { port: PORT }));

  // Graceful shutdown (SIGINT + SIGTERM: drain HTTP, then close the DB)
  // Open collage streams never end by themselves; closing them lets the
  // server drain instead of timing out on every deploy.
  registerShutdown({ serviceName: 'album-service', server, onShutdown: closeCollageStreams });
};

start().catch((error: Error) => {
  logger.error('Failed to start album-service', { error: error.message, stack: error.stack });
  process.exit(1);
});
