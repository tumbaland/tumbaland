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
export { createHealthCheck } from './health/createHealthCheck';
export type { HealthCheckConfig } from './health/createHealthCheck';

// Database
export { connectDB, disconnectDB } from './database/connection';

// Config
export { requireEnv } from './config/env';

// Errors
export { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, TooManyRequestsError, PaymentRequiredError } from './errors/HttpError';
export type { PaymentRequiredDetails } from './errors/HttpError';

// Entitlements (plan limits, usage meters, enforcement)
export * from './entitlements';

// Group ownership (the quota subject for anything pooled)
export * from './groups';

// API keys (non-browser clients: MCP servers, scripts, agents)
export * from './apiKeys';

// OAuth 2.1 authorization server, for assistants connecting over MCP
export * from './oauth';
export * from './audit';

// Middleware
export { authenticateToken, optionalAuth } from './middleware/authMiddleware';
export {
  requireInternalServiceToken,
  internalServiceTokenBypass,
  allowUserOrInternalService,
  verifyInternalToken,
  INTERNAL_TOKEN_HEADER,
  SERVICE_ID_HEADER
} from './middleware/internalServiceAuth';
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