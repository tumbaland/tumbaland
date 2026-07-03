import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import planRoutes from './routes/planRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { stripeWebhook } from './controllers/stripeController';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler, standardRateLimiter } from '@tumbaland/core';

// rateLimiter/parseJson/parseCookies are all off here: the webhook route
// below must be registered — and therefore exempt — before the rate
// limiter (Stripe delivers from its own servers, sometimes in bursts, and
// must never be throttled like a browser client) and keep the raw Buffer
// body (so json parsing can't run first either).
const app = createBaseApp({ rateLimiter: false, parseJson: false, parseCookies: false });

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(standardRateLimiter);
app.use(express.json());
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
