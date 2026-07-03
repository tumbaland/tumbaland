import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { logger, requireEnv } from '@tumbaland/core';
import { connectDB } from './config/database';
import { startDailyPortfolioUpdate } from './services/portfolioScheduler.service';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB();

// Start daily portfolio update job
startDailyPortfolioUpdate();

const PORT = process.env.PORT || 4003;

// Start the server
app.listen(PORT, () => logger.info('Finance service started successfully', { port: PORT }));
