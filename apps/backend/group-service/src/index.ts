import dotenv from 'dotenv';

dotenv.config();

import { connectDB, logger, requireEnv } from '@tumbaland/core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

connectDB('group-service').catch(err => logger.error('MongoDB connection error', { error: err.message }));

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => logger.info('Group service started successfully', { port: PORT }));
