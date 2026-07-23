import dotenv from 'dotenv';

dotenv.config();

import { logger, registerShutdown } from '@tumbaland/backend-core';
import app from './app';

// Validate required env vars at startup
const REQUIRED_ENV = ['FILE_SERVICE_API_KEY', 'FILE_SERVICE_HMAC_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, () => logger.info('File service started', { port: PORT }));

// Graceful shutdown (SIGINT + SIGTERM). No DB connection to close.
registerShutdown({ serviceName: 'file-service', server, disconnectDatabase: false });
