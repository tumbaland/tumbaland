import dotenv from 'dotenv';

dotenv.config();

import { logger } from '@tumbaland/backend-core';
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

app.listen(PORT, () => logger.info('File service started', { port: PORT }));
