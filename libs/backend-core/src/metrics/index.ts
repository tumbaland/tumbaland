import promClient from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: process.env.SERVICE_NAME || 'unknown-service',
  version: process.env.npm_package_version || '1.0.0'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

export const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const databaseQueriesTotal = new promClient.Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'collection', 'status']
});

export const businessMetrics = {
  albumsCreated: new promClient.Counter({
    name: 'albums_created_total',
    help: 'Total number of albums created'
  }),

  filesUploaded: new promClient.Counter({
    name: 'files_uploaded_total',
    help: 'Total number of files uploaded',
    labelNames: ['file_type']
  }),

  usersRegistered: new promClient.Counter({
    name: 'users_registered_total',
    help: 'Total number of users registered'
  }),

  paymentsProcessed: new promClient.Counter({
    name: 'payments_processed_total',
    help: 'Total number of payments processed',
    labelNames: ['status', 'method']
  })
};

// Metrics endpoint handler
export const metricsHandler = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error generating metrics');
  }
};

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url } = req;

  // Increment active connections
  activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const { statusCode } = res;

    // Record metrics
    httpRequestDuration
      .labels(method, url, statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(method, url, statusCode.toString())
      .inc();

    // Decrement active connections
    activeConnections.dec();
  });

  next();
};

export { register };