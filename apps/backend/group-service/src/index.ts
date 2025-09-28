import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { authenticateToken } from './middleware/authMiddleware';
import groupRoutes from './routes/groupRoutes';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLogger } from '@tumbaland/core';

dotenv.config();

const app = express();
app.use(correlationMiddleware);
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.connect(MONGODB_URI).then(() => logger.info('MongoDB connected')).catch(err => logger.error('MongoDB connection error', { error: err.message }));

// Health check endpoint
app.get('/health', healthCheck);

app.use('/api', authenticateToken);
app.use('/api/groups', groupRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => logger.info('Group service started successfully', { port: PORT }));
