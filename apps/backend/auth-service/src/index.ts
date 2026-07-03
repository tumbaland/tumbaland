import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { logger, requireEnv } from '@tumbaland/core';
import { connectDb } from './config/db';
import app from './app';

// Fail fast if the JWT secret is missing — tokens must never be signed with a default
requireEnv('JWT_SECRET');

const PORT = process.env.PORT || 5001;

// Connect DB then start server
connectDb()
  .then(() => {
    app.listen(PORT, () => logger.info('Auth service started successfully', { port: PORT }));
  })
  .catch((err) => {
    logger.error('Failed to start auth-service', { error: err.message, stack: err.stack });
    process.exit(1);
  });
