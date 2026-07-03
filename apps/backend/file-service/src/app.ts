import express, { Request, Response } from 'express';
import {
  errorHandler,
  correlationMiddleware,
  requestLoggerWithMetrics,
  metricsHandler,
  tracingMiddleware,
  createCorsMiddleware
} from '@tumbaland/core';
import routes from './routes/routes';

const app = express();

// Middleware
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(requestLoggerWithMetrics);
app.use(createCorsMiddleware());

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
