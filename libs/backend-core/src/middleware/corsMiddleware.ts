import cors from 'cors';
import type { RequestHandler } from 'express';
import logger from '../logging/logger';

export interface CorsMiddlewareOptions {
  /**
   * Comma-separated origin whitelist. Defaults to process.env.CORS_ORIGIN,
   * read per-request so it works regardless of dotenv.config() timing.
   */
  origins?: string;
  exposedHeaders?: string[];
  /**
   * Path prefixes that skip the origin check entirely.
   *
   * For endpoints the browser *navigates* to rather than fetches — an OAuth
   * authorize page and the consent form it posts back. CORS governs
   * script-initiated cross-origin reads and has nothing to say about a
   * top-level form submission, but it still blocks one: Firefox sends a
   * literal `Origin: null` after a cross-site redirect chain, which is truthy,
   * matches no whitelist entry, and turns a legitimate consent into a 500.
   *
   * Nothing is weakened by skipping them. These routes carry no XHR-readable
   * data, and what actually protects the consent POST is its signed consent
   * token, not the origin header.
   */
  bypassPaths?: string[];
}

/**
 * Shared CORS middleware with an explicit origin whitelist.
 * Requests without an Origin header (server-to-server, curl, health checks)
 * are always allowed; browser requests must match the whitelist.
 */
export function createCorsMiddleware(options: CorsMiddlewareOptions = {}): RequestHandler {
  const bypassPaths = options.bypassPaths ?? [];

  const corsHandler = cors({
    origin: (origin, callback) => {
      const allowedOrigins = (options.origins ?? process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn('Blocked CORS origin', { origin });
      return callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true,
    // PATCH belongs here as much as PUT: leaving it out lets the preflight
    // succeed and then has the browser block the request it just approved,
    // which surfaces in the UI as a bare "failed to save" with a 204 in the
    // network tab and no failing request to point at.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id', 'x-session-id'],
    exposedHeaders: options.exposedHeaders
  });

  if (bypassPaths.length === 0) return corsHandler as RequestHandler;

  return (req, res, next) => {
    if (bypassPaths.some((prefix) => req.path.startsWith(prefix))) return next();
    return (corsHandler as RequestHandler)(req, res, next);
  };
}
