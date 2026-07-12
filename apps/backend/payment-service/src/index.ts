import dotenv from 'dotenv';

dotenv.config();

import { connectDB, logger, requireEnv } from '@tumbaland/backend-core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

connectDB('payment-service');

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => logger.info('Payment service started successfully', { port: PORT }));
