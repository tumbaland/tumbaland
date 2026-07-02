import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database';
import planRoutes from './routes/planRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { stripeWebhook } from './controllers/stripeController';
import path from 'path';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, requireEnv, createCorsMiddleware } from '@tumbaland/core';

dotenv.config();

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const app = express();
const PORT = process.env.PORT || 5005;

connectDB();

app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(createCorsMiddleware());
// JSON parser applied after defining webhook route (so webhook keeps raw Buffer)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());
app.use(requestLoggerWithMetrics);
app.use(cookieParser());

// Serve OpenAPI docs as static files (before route mounting)
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => logger.info('Payment service started successfully', { port: PORT }));

export default app;
