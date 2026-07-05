import express, { Request, Response } from 'express';
import { errorHandler, createBaseApp, createRateLimiter, metricsHandler } from '@tumbaland/core';
import routes from './routes/routes';

// Rate-limit policy for a file host, not a JSON API:
// - /internal/* is server-to-server, guarded by X-Internal-Api-Key, and all
//   traffic comes from a handful of service IPs — a per-IP limit only breaks
//   legitimate bursts (a 100-photo collage needs URLs for 200 files), so it
//   is exempt.
// - Public signed-URL routes are HMAC-token guarded; the limiter is just
//   abuse protection. One collage view loads ~2 files per photo, so the
//   default 300/15min starves the browser — allow a much larger budget.
const fileHostRateLimiter = createRateLimiter({
  max: 5000,
  skip: (req) => req.path.startsWith('/internal/')
});

// No cookies (API key / signed URL auth only) and no blanket JSON parsing —
// upload routes stream raw binary and parse conditionally below.
const app = createBaseApp({ parseJson: false, parseCookies: false, rateLimiter: fileHostRateLimiter });

// Raw body parser for file uploads – do NOT use express.json() before file routes.
// We handle raw streams manually in controllers, so only parse JSON where needed.
app.use((req, res, next) => {
  // Skip JSON parsing for upload routes – they stream raw binary
  if (req.path.includes('/files/upload/') || req.path.includes('/internal/files/')) {
    if (req.method === 'PUT') return next();
  }
  express.json()(req, res, next);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'file-service', timestamp: new Date().toISOString() });
});

// Metrics
app.get('/metrics', metricsHandler);

// All file routes
app.use('/', routes);

// Error handler
app.use(errorHandler);

export default app;
