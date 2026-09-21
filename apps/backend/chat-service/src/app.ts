import express from 'express';
import path from 'path';
import { authenticateToken, createBaseApp, errorHandler, metricsHandler, standardRateLimiter } from '@tumbaland/backend-core';
import chatRoutes from './routes/chatRoutes';
import { stream } from './controllers/streamController';
import { healthCheck } from './controllers/healthController';

/**
 * The rate limiter is mounted by hand below rather than by `createBaseApp`, so
 * the SSE stream can be registered — and therefore exempted — ahead of it.
 *
 * A stream is one request that lasts for hours, which the request limiter has
 * no useful opinion about. What it does do is count a phone that reconnects on
 * every network change, and the one route that has to keep working on a flaky
 * connection is the one that tells the app it has messages. The stream carries
 * a per-user cap of its own instead (`MAX_STREAMS_PER_USER` in streamHub),
 * which is the right shape of limit for a long-lived connection.
 */
const app = createBaseApp({ rateLimiter: false });

// Health check endpoint (DB-aware readiness; /health/live is mounted by createBaseApp)
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Serve OpenAPI docs as static files (before auth middleware)
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Registered before the limiter, so it is exempt. It still authenticates, and
// it never calls next(), so nothing below sees the request.
app.get('/api/chat/stream', authenticateToken, stream);

app.use(standardRateLimiter);

app.use('/api', authenticateToken);
app.use('/api/chat', chatRoutes);

// Error handler
app.use(errorHandler);

export default app;
