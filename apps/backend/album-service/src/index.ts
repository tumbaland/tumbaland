import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB('album-service');

const PORT = process.env.PORT || 4002;

// Start the server
const server = app.listen(PORT, () =>
  logger.info('Album service started successfully', { port: PORT })
);

// Graceful shutdown (SIGINT + SIGTERM: drain HTTP, then close the DB)
registerShutdown({ serviceName: 'album-service', server });
