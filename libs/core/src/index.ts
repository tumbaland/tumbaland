// @tumbaland/core - Core shared functionality for Tumbaland backend services

// Logging
export { default as logger } from './logging/logger';

// Health checks
export { healthCheck, metricsHandler } from './health/healthController';

// Database
export { connectDB } from './database/connection';

// Config
export { requireEnv } from './config/env';

// Middleware
export { authenticateToken } from './middleware/authMiddleware';
export { createCorsMiddleware } from './middleware/corsMiddleware';
export { errorHandler } from './middleware/errorHandler';
export { requestLogger, requestLoggerWithMetrics, simpleRequestLogger } from './middleware/requestLogger';

// Types
export type { UserPayload } from './types/auth';

// Utils
export { generateCorrelationId, correlationMiddleware } from './utils/correlation';
export { createApiResponse } from './utils/response';

// Metrics
export {
  metricsMiddleware,
  httpRequestDuration,
  httpRequestsTotal,
  databaseQueryDuration,
  databaseQueriesTotal,
  businessMetrics,
  register
} from './metrics';

// Tracing
export {
  initTracer,
  getTracer,
  startSpan,
  tracingMiddleware,
  createChildSpan,
  logToSpan,
  setSpanTag,
  injectHeaders,
  extractSpanContext
} from './tracing';