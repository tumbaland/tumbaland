// @tumbaland/backend-core - Core shared functionality for Tumbaland backend services

// App bootstrap
export { createBaseApp } from './app/createBaseApp';
export type { CreateBaseAppOptions } from './app/createBaseApp';
export { registerShutdown } from './app/shutdown';
export type { RegisterShutdownOptions } from './app/shutdown';

// Logging
export { default as logger } from './logging/logger';

// Health checks
export { healthCheck, healthLive, metricsHandler } from './health/healthController';

// Database
export { connectDB, disconnectDB } from './database/connection';

// Config
export { requireEnv } from './config/env';

// Errors
export { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, TooManyRequestsError } from './errors/HttpError';

// Middleware
export { authenticateToken } from './middleware/authMiddleware';
export { createCorsMiddleware } from './middleware/corsMiddleware';
export { errorHandler } from './middleware/errorHandler';
export { requestLogger, requestLoggerWithMetrics, simpleRequestLogger } from './middleware/requestLogger';
export { securityHeaders, createRateLimiter, standardRateLimiter, strictRateLimiter } from './middleware/security';
export { validate } from './middleware/validate';

// Types
export type { UserPayload } from './types/auth';

// Utils
export { generateCorrelationId, correlationMiddleware } from './utils/correlation';
export { createApiResponse, sendSuccess, sendError } from './utils/response';
export type { ApiResponse } from './utils/response';
export { buildAccessQuery, canAccessResource } from './utils/permissionUtils';

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