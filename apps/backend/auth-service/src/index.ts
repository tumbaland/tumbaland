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

// Listen first, connect in the background: connectDB retries indefinitely, so
// gating listen() on it meant a Mongo outage at boot left nothing bound to the
// port at all — the proxy returned 502 with no way to see why. Serving /health
// immediately reports the disconnected state instead, and routes recover on
// their own once the retry loop succeeds.
const server = app.listen(PORT, () =>
  logger.info('Auth service started successfully', { port: PORT })
);
// Graceful shutdown (SIGINT + SIGTERM: drain HTTP, then close the DB)
registerShutdown({ serviceName: 'auth-service', server });

connectDB('auth-service').catch((err) => {
  // Only non-retryable config errors (a missing MONGODB_URI) land here.
  logger.error('Failed to start auth-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
