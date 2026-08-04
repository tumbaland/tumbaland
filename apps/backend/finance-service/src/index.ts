import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import { startDailyPortfolioUpdate } from './services/portfolioScheduler.service';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const PORT = process.env.PORT || 4003;

// Connect before binding the port: a service that can't reach MongoDB has
// nothing to serve, and listening anyway would pass the health check while
// failing every request. Exiting hands recovery to the container restart policy.
const start = async (): Promise<void> => {
  await connectDB('finance-service');

  // Scheduled after the connection is up — the job reads and writes holdings,
  // so arming it earlier would just fire queries at a disconnected mongoose.
  startDailyPortfolioUpdate();

  const server = app.listen(PORT, () =>
    logger.info('Finance service started successfully', { port: PORT })
  );

  // Graceful shutdown (SIGINT + SIGTERM: drain HTTP, then close the DB)
  registerShutdown({ serviceName: 'finance-service', server });
};

start().catch((error: Error) => {
  logger.error('Failed to start finance-service', { error: error.message, stack: error.stack });
  process.exit(1);
});
