import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { authenticateToken } from './middleware/authMiddleware';
import groupRoutes from './routes/groupRoutes';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware } from '@tumbaland/core';

dotenv.config();

const app = express();
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(requestLoggerWithMetrics);
app.use(cors({
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id', 'x-session-id']
}));
app.use(express.json()); // Add body parser middleware

const MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.connect(MONGODB_URI).then(() => logger.info('MongoDB connected')).catch(err => logger.error('MongoDB connection error', { error: err.message }));

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

app.use('/api', authenticateToken);
app.use('/api/groups', groupRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => logger.info('Group service started successfully', { port: PORT }));
