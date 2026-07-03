import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { authenticateToken } from './middleware/authMiddleware';
import groupRoutes from './routes/groupRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, createCorsMiddleware } from '@tumbaland/core';

const app = express();
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(requestLoggerWithMetrics);
app.use(createCorsMiddleware());
app.use(express.json()); // Add body parser middleware
app.use(cookieParser());

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Serve OpenAPI docs as static files (before auth middleware)
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

app.use('/api', authenticateToken);
app.use('/api/groups', groupRoutes);

// Error handler
app.use(errorHandler);

export default app;
