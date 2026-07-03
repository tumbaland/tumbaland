import dotenv from 'dotenv';

dotenv.config();

import mongoose from 'mongoose';
import { logger, requireEnv } from '@tumbaland/core';
import app from './app';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.connect(MONGODB_URI).then(() => logger.info('MongoDB connected')).catch(err => logger.error('MongoDB connection error', { error: err.message }));

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => logger.info('Group service started successfully', { port: PORT }));
