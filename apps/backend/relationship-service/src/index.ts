import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { logger, requireEnv } from '@tumbaland/core';
import { connectDB } from './config/database';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 4001;

// Start the server
app.listen(PORT, () => logger.info('Relationship service started successfully', { port: PORT }));
