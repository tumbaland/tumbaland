import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/authRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, createCorsMiddleware } from '@tumbaland/core';

const app = express();

// Middleware
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(requestLoggerWithMetrics);
app.use(express.json());
app.use(cookieParser());
app.use(createCorsMiddleware({ exposedHeaders: ['Content-Type', 'Content-Length', 'ETag', 'Cache-Control'] }));

// Serve static documentation files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Routes
app.use('/auth', authRoutes);

// Documentation root redirect
app.get('/docs', (req: Request, res: Response) => {
  res.redirect('/api/docs/index.html');
});

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

export default app;
