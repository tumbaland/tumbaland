import express, { Request, Response } from 'express';
import path from 'path';
import { errorHandler, createBaseApp, createRateLimiter, metricsHandler } from '@tumbaland/backend-core';
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
  // Skip JSON parsing for upload routes – they stream raw binary. Excludes
  // /internal/files/folder specifically: it matches the same PUT+path-prefix
  // check but takes a JSON body ({ prefix }), not a binary stream — without
  // this exclusion its body was silently dropped and validation always failed.
  const isRawUploadRoute =
    (req.path.includes('/files/upload/') || req.path.includes('/internal/files/')) &&
    req.path !== '/internal/files/folder';
  if (isRawUploadRoute && req.method === 'PUT') return next();
  express.json()(req, res, next);
});

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check (/health/live is mounted by createBaseApp)
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
