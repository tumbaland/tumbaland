import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { connectDB } from './config/database';
import activityRoutes from './routes/activities';
import activityTypeRoutes from './routes/activityTypes';
import statisticsRoutes from './routes/statistics';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, requireEnv } from '@tumbaland/core';

// Load environment variables
dotenv.config();

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const app = express();
const PORT = process.env.PORT || 4001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(cors({
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id', 'x-session-id']
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLoggerWithMetrics);

// Routes
app.use('/api/activities', activityRoutes);
app.use('/api/activity-types', activityTypeRoutes);
app.use('/api/statistics', statisticsRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Relationship service started successfully', { port: PORT }));

export default app;
