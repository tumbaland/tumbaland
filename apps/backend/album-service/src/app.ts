import express from 'express';
import path from 'path';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';
import statisticsRoutes from './routes/statisticsRoutes';
import collageRoutes from './collage/collageRoutes';
import internalRoutes from './routes/internalRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler, createRateLimiter } from '@tumbaland/backend-core';
import collageLiveRoutes from './collage/collageLiveRoutes';

// The rate limiter is mounted by hand below rather than by createBaseApp, so
// /internal can be registered, and therefore exempted, ahead of it. chat-service
// calls it from one container address for every photo anyone sends; counting
// that per IP would throttle the whole deployment's chat-to-album path. The
// internal-service token is the gate instead.
const app = createBaseApp({ rateLimiter: false });

app.use('/internal', internalRoutes);

// Live collage editing has budgets of its own (see collageLiveRoutes), so it is
// registered ahead of the general limiter. It authenticates and checks access
// to the collage like any other request.
app.use('/api/collages', collageLiveRoutes);

/**
 * Everything else, counted per address. The default of 300 per 15 minutes was
 * sized for a person browsing, and it is far too small for what connected
 * assistants send: they reach this service through mcp-service, so every
 * assistant of every user arrives from one address and shares one bucket, and
 * a single edit round of a collage is six or seven requests. Ten times the
 * default, the same figure as saving in the editor above, still stops a
 * runaway client within the minute.
 */
export const GENERAL_REQUESTS_PER_WINDOW = 3000;
app.use(createRateLimiter({ max: GENERAL_REQUESTS_PER_WINDOW }));

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
