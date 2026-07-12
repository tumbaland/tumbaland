import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, disconnectDB, logger, requireEnv } from '@tumbaland/backend-core';
import { startDailyPortfolioUpdate } from './services/portfolioScheduler.service';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB('finance-service');

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDB('finance-service');
  process.exit(0);
});

// Start daily portfolio update job
startDailyPortfolioUpdate();

const PORT = process.env.PORT || 4003;

// Start the server
app.listen(PORT, () => logger.info('Finance service started successfully', { port: PORT }));
