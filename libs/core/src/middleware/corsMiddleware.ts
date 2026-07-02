import cors from 'cors';
import logger from '../logging/logger';

export interface CorsMiddlewareOptions {
  /**
   * Comma-separated origin whitelist. Defaults to process.env.CORS_ORIGIN,
   * read per-request so it works regardless of dotenv.config() timing.
   */
  origins?: string;
  exposedHeaders?: string[];
}

/**
 * Shared CORS middleware with an explicit origin whitelist.
 * Requests without an Origin header (server-to-server, curl, health checks)
 * are always allowed; browser requests must match the whitelist.
 */
export function createCorsMiddleware(options: CorsMiddlewareOptions = {}) {
  return cors({
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id', 'x-session-id'],
    exposedHeaders: options.exposedHeaders
  });
}
