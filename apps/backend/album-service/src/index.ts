import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import connectDB from './config/database';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';
import statisticsRoutes from './routes/statisticsRoutes';
import collageRoutes from './collage/collageRoutes';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, requireEnv, createCorsMiddleware } from '@tumbaland/core';

// Load environment variables
dotenv.config();

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(requestLoggerWithMetrics);
app.use(createCorsMiddleware());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/albums', albumRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/collages', collageRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Album service started successfully', { port: PORT }));

export default app;
