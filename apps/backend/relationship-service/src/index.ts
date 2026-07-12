import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, disconnectDB, logger, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB('relationship-service');

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await disconnectDB('relationship-service');
    process.exit(0);
  } catch {
    process.exit(1);
  }
});

const PORT = process.env.PORT || 4001;

// Start the server
app.listen(PORT, () => logger.info('Relationship service started successfully', { port: PORT }));
