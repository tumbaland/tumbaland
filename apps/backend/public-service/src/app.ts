import express from 'express';
import path from 'path';
import todoRoutes from './routes/todoRoutes';
import { loadTodos } from './services/todoService';
import { healthCheck } from './controllers/healthController';
import { submitLogs, getLogsHealth } from './controllers/logController';
import { errorHandler, createBaseApp, strictRateLimiter, validate } from '@tumbaland/core';
import { submitLogsSchema } from './validation/schemas';

// Every route here is unauthenticated, so it gets at least the standard
// limiter as a baseline (built into createBaseApp); /api/todo additionally
// gets the strict one below since it's the one truly public, no-purpose-gated
// endpoint. /logs stays on the standard limiter — it's telemetry ingestion
// from up to eight frontends batching client logs, not a brute-force target,
// and a strict shared cap there would drop legitimate traffic in normal use.
// No cookies, no tracing/metrics — this service never used them.
const app = createBaseApp({ tracing: false, metrics: false, parseCookies: false });

// Load todos into memory on app start
loadTodos();

// Routes
app.use('/api/todo', strictRateLimiter, todoRoutes);

// Logging routes
app.post('/logs', validate(submitLogsSchema), submitLogs);
app.get('/logs/health', getLogsHealth);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint (all this service needs — no DB dependency; /health/live is mounted by createBaseApp)
app.get('/health', healthCheck);

// Error handler
app.use(errorHandler);

export default app;
