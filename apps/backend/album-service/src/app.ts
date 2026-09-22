import express from 'express';
import path from 'path';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';
import statisticsRoutes from './routes/statisticsRoutes';
import collageRoutes from './collage/collageRoutes';
import internalRoutes from './routes/internalRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler, standardRateLimiter } from '@tumbaland/backend-core';

// The rate limiter is mounted by hand below rather than by createBaseApp, so
// /internal can be registered, and therefore exempted, ahead of it. chat-service
// calls it from one container address for every photo anyone sends; counting
// that per IP would throttle the whole deployment's chat-to-album path. The
// internal-service token is the gate instead.
const app = createBaseApp({ rateLimiter: false });

app.use('/internal', internalRoutes);

app.use(standardRateLimiter);

// Routes
app.use('/api/albums', albumRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/collages', collageRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint (DB-aware readiness; /health/live is mounted by createBaseApp)
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

export default app;
