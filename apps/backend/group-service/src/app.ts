import express from 'express';
import path from 'path';
import { authenticateToken } from './middleware/authMiddleware';
import groupRoutes from './routes/groupRoutes';
import internalRoutes from './routes/internalRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler, standardRateLimiter } from '@tumbaland/backend-core';

// The rate limiter is mounted by hand below rather than by createBaseApp, so
// /internal can be registered — and therefore exempted — ahead of it.
const app = createBaseApp({ rateLimiter: false });

// Every entitlement chokepoint that touches a group asks this route who pays,
// from one container IP per service. An IP-counted limiter would throttle the
// deployment's whole enforcement path, and the client fails back to billing the
// caller — so a 429 here would quietly bill the wrong person. The
// internal-service token is the gate instead.
app.use('/internal', internalRoutes);

app.use(standardRateLimiter);

// Health check endpoint (DB-aware readiness; /health/live is mounted by createBaseApp)
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
