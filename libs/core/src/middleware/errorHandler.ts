import { Request, Response, NextFunction } from 'express';
import logger from '../logging/logger';

/**
 * Global error handler middleware
 * Logs errors and returns appropriate responses
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment ? error.message : 'Something went wrong';

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: errorMessage,
    ...(isDevelopment && { stack: error.stack })
  });
}