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
//   abuse protection. A browser opening one large album legitimately asks for
//   hundreds of files in a few seconds, so the budget is generous — and the
//   window is a minute rather than 15, because the failure mode of getting
//   this wrong is a wall of broken images that has to clear on its own. A
//   minute of throttling is a hiccup; a quarter of an hour is an outage.
const fileHostRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  skip: (req) => req.path.startsWith('/internal/')
});

// No cookies (API key / signed URL auth only) and no blanket JSON parsing —
// upload routes stream raw binary and parse conditionally below.
const app = createBaseApp({ parseJson: false, parseCookies: false, rateLimiter: fileHostRateLimiter });

// Raw body parser for file uploads – do NOT use express.json() before file routes.
// We handle raw streams manually in controllers, so only parse JSON where needed.
app.use((req, res, next) => {
  // Skip JSON parsing for upload routes – they stream raw binary. Every PUT
  // under these paths is an upload; the folder delete is a DELETE with a JSON
  // body, which is parsed as usual.
  const isRawUploadRoute = req.path.includes('/files/upload/') || req.path.includes('/internal/files/');
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
