import express, { Express, RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { correlationMiddleware } from '../utils/correlation';
import { tracingMiddleware } from '../tracing';
import { requestLogger, requestLoggerWithMetrics } from '../middleware/requestLogger';
import { createCorsMiddleware, CorsMiddlewareOptions } from '../middleware/corsMiddleware';
import { securityHeaders, standardRateLimiter } from '../middleware/security';

export interface CreateBaseAppOptions {
  /** Passed through to createCorsMiddleware. */
  corsOptions?: CorsMiddlewareOptions;
  /**
   * Defaults to standardRateLimiter; pass strictRateLimiter or a custom one
   * to override. Pass `false` to skip mounting one here entirely — e.g. when
   * a route (like a webhook) must be registered, and therefore exempted,
   * before the limiter, and the service applies it itself afterward.
   */
  rateLimiter?: RequestHandler | false;
  /** Mount express.json() here. Set false when a route needs the raw body first (e.g. a webhook) or handles its own parsing. Default true. */
  parseJson?: boolean;
  /** Mount cookie-parser here. Set false for services that don't use cookies. Default true. */
  parseCookies?: boolean;
  /** Mount tracingMiddleware. Default true. */
  tracing?: boolean;
  /** Use requestLoggerWithMetrics (adds Prometheus histograms) instead of the plain requestLogger. Default true. */
  metrics?: boolean;
}

/**
 * Assembles the middleware stack every service was hand-rolling in its own
 * index.ts (correlation → tracing → request logging → security → rate
 * limiting → CORS → cookies → JSON body). Services still mount their own
 * routes, `/health`, `/metrics`, and `app.use(errorHandler)` last —
 * this only owns the common prefix, not the whole app lifecycle.
 *
 * Services with non-standard body parsing (a webhook needing the raw body,
 * or conditional parsing per-route) should pass `parseJson`/`parseCookies:
 * false` and mount those themselves at the exact point they need to.
 */
export function createBaseApp(options: CreateBaseAppOptions = {}): Express {
  const {
    corsOptions,
    rateLimiter = standardRateLimiter,
    parseJson = true,
    parseCookies = true,
    tracing = true,
    metrics = true
  } = options;

  const app = express();

  app.use(securityHeaders);
  if (rateLimiter) app.use(rateLimiter);
  app.use(correlationMiddleware);
  if (tracing) app.use(tracingMiddleware);
  app.use(metrics ? requestLoggerWithMetrics : requestLogger);
  app.use(createCorsMiddleware(corsOptions));
  if (parseCookies) app.use(cookieParser());
  if (parseJson) app.use(express.json());

  return app;
}
