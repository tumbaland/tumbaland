import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';
import logger from '../logging/logger';
import { metricsMiddleware } from '../metrics';

/**
 * Morgan middleware configured to use Winston logger
 * Logs HTTP requests in structured format
 */
export const requestLogger = morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.http(message.trim());
    }
  }
});

/**
 * Combined middleware that includes both logging and metrics
 * Use this instead of separate requestLogger and metricsMiddleware
 */
export const requestLoggerWithMetrics = [requestLogger, metricsMiddleware];

/**
 * Simple request logger for development
 * Logs basic request info with correlation ID
 */
export const simpleRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const correlationId = req.correlationId || 'unknown';

  logger.info(`→ ${req.method} ${req.url}`, {
    correlationId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`← ${req.method} ${req.url} ${res.statusCode} ${duration}ms`, {
      correlationId,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
};