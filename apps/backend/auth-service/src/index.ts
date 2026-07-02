import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import { connectDb } from './config/db';
import path from 'path';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, requireEnv, createCorsMiddleware } from '@tumbaland/core';

// Load environment variables
dotenv.config();

// Fail fast if the JWT secret is missing — tokens must never be signed with a default
requireEnv('JWT_SECRET');

const app = express();
const PORT = process.env.PORT || 5001;

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

// Connect DB then start server
connectDb()
  .then(() => {
    app.listen(PORT, () => logger.info('Auth service started successfully', { port: PORT }));
  })
  .catch((err) => {
    logger.error('Failed to start auth-service', { error: err.message, stack: err.stack });
    process.exit(1);
  });

export default app;
