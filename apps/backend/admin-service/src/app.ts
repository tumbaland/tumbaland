import express from 'express';
import path from 'path';
import {
  authenticateToken,
  createBaseApp,
  errorHandler,
  metricsHandler,
  requireAdmin
} from '@tumbaland/backend-core';
import adminRoutes from './routes/adminRoutes';
import { healthCheck } from './controllers/healthController';

const app = createBaseApp();

// Health check endpoint (DB-aware readiness; /health/live is mounted by createBaseApp)
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Serve OpenAPI docs as static files (before auth middleware)
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// A session of an administrator, for everything under /api. `authenticateToken`
// refuses connected assistants outright and `requireAdmin` refuses keys, so
// nothing but a person who is an administrator reaches per-account usage.
app.use('/api', authenticateToken, requireAdmin, adminRoutes);

// Error handler
app.use(errorHandler);

export default app;
