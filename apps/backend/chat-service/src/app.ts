import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import {
  authenticateToken,
  createBaseApp,
  createRateLimiter,
  errorHandler,
  metricsHandler
} from '@tumbaland/backend-core';
import chatRoutes from './routes/chatRoutes';
import internalRoutes from './routes/internalRoutes';
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

// album-service, not a browser: the internal token is the gate, ahead of the
// limiters, which count browsers.
app.use('/internal', internalRoutes);

/**
 * Two limits rather than the usual one per address.
 *
 * The couple using this usually share a home connection, so a per-address
 * limit is one budget for both of them. Typing notices alone can spend 24 a
 * minute each. Fallback polling, read receipts and maps add more: the default
 * 300 requests per 15 minutes can lock out even one active person. Count over
 * one minute instead, with room for sustained use and brief reconnect bursts.
 * The real limit is per person per address, after sign-in; the per-address
 * limit ahead of it stops a flood while leaving room for a shared connection.
 * Message sends, calls, typing, geocoding and GPS uploads keep their own limits.
 */
app.use(createRateLimiter({ windowMs: 60_000, max: 600 }));

app.use('/api', authenticateToken);
app.use(
  '/api',
  createRateLimiter({
    windowMs: 60_000,
    max: 120,
    // Position uploads already have a one-minute limiter. Counting a drive
    // against this shared budget would eventually lock the driver out of chat.
    skip: (req) => req.method === 'POST' && /^\/chat\/conversations\/[^/]+\/live\/position\/?$/.test(req.path),
    // authenticateToken has already turned away anyone without a user.
    keyGenerator: (req) => `${req.user?.id ?? ''}@${ipKeyGenerator(req.ip ?? '')}`
  })
);
app.use('/api/chat', chatRoutes);

// Error handler
app.use(errorHandler);

export default app;
