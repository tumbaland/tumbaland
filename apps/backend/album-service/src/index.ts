import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDB, logger, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB('album-service');

const PORT = process.env.PORT || 4002;

// Start the server
app.listen(PORT, () => logger.info('Album service started successfully', { port: PORT }));
