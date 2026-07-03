import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import planRoutes from './routes/planRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { stripeWebhook } from './controllers/stripeController';
import { healthCheck } from './controllers/healthController';
import { errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, createCorsMiddleware } from '@tumbaland/core';

const app = express();

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

export default app;
