import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';
import statisticsRoutes from './routes/statisticsRoutes';
import collageRoutes from './collage/collageRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, createCorsMiddleware, securityHeaders, standardRateLimiter } from '@tumbaland/core';

const app = express();

// Middleware
app.use(securityHeaders);
app.use(standardRateLimiter);
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

export default app;
