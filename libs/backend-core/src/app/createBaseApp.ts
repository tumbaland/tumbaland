import express, { Express, RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { correlationMiddleware } from '../utils/correlation';
import { tracingMiddleware } from '../tracing';
import { requestLogger, requestLoggerWithMetrics } from '../middleware/requestLogger';
import { slowRequestLogger } from '../middleware/serverTiming';
import { createCorsMiddleware, CorsMiddlewareOptions } from '../middleware/corsMiddleware';
import { securityHeaders, standardRateLimiter } from '../middleware/security';
import { healthLive } from '../health/healthController';

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
  /**
   * Value for Express's `trust proxy`. Defaults to trusting private/loopback
   * addresses — see the note on tumbaland-proxy below. Pass `false` for a
   * service exposed directly to clients with no proxy in front of it.
   */
  trustProxy?: Parameters<Express['set']>[1];
}

/**
 * Assembles the middleware stack every service was hand-rolling in its own
 * index.ts (correlation → tracing → request logging → security → rate
 * limiting → CORS → cookies → JSON body). Services still mount their own
 * routes, `/health` (DB-aware readiness), `/metrics`, and
 * `app.use(errorHandler)` last — this only owns the common prefix, not the
 * whole app lifecycle.
 *
 * `/health/live` is the one exception: it's mounted here, first, ahead of
 * every other middleware. It has zero per-service variation (it never
 * touches a dependency, just confirms the process is up), so — unlike
 * `/health` — there's nothing for a service to customize. Mounting it
 * before the rate limiter also matters operationally: a service under
 * heavy legitimate traffic shouldn't have its own liveness probe start
 * getting 429s and get killed for being "unhealthy" at the exact moment
 * it's just busy.
 *
 * Services with non-standard body parsing (a webhook needing the raw body,
 * or conditional parsing per-route) should pass `parseJson`/`parseCookies:
 * false` and mount those themselves at the exact point they need to.
 *
 * `trust proxy` is on by default because nothing here is reached directly:
 * every service sits behind tumbaland-proxy, which sets `X-Forwarded-For`.
 * Left at Express's default (`false`) that header is ignored, which
 * express-rate-limit reports as `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` — and
 * it is right to: the limiter would then key every request in the cluster on
 * the proxy's own container IP, so one busy client could exhaust the window
 * for everyone.
 *
 * The value is `loopback, linklocal, uniquelocal` (private ranges) rather
 * than a hop count, because the chain length differs per ingress path: a
 * direct hit arrives as `client` + the proxy's own socket address, while
 * traffic through the Cloudflare tunnel arrives as `client, 127.0.0.1` (the
 * local cloudflared) + that same socket address. Express walks the chain
 * right-to-left and stops at the first address it does not trust, so both
 * paths land on the real client; a fixed number would be wrong for one of
 * them. All the intermediaries are private addresses and the client is not,
 * which is exactly the split this preset encodes.
 */
export function createBaseApp(options: CreateBaseAppOptions = {}): Express {
  const {
    corsOptions,
    rateLimiter = standardRateLimiter,
    parseJson = true,
    parseCookies = true,
    tracing = true,
    metrics = true,
    trustProxy = 'loopback, linklocal, uniquelocal'
  } = options;

  const app = express();

  app.set('trust proxy', trustProxy);

  app.get('/health/live', healthLive);

  app.use(securityHeaders);
  if (rateLimiter) app.use(rateLimiter);
  app.use(correlationMiddleware);
  if (tracing) app.use(tracingMiddleware);
  app.use(metrics ? requestLoggerWithMetrics : requestLogger);
  app.use(slowRequestLogger());
  app.use(createCorsMiddleware(corsOptions));
  if (parseCookies) app.use(cookieParser());
  if (parseJson) app.use(express.json());

  return app;
}
