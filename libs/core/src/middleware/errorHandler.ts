import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../logging/logger';

/**
 * Global error handler middleware
 * Logs errors and returns appropriate responses
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: (req as any).correlationId
  });

  // Add CORS headers to error responses
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('tumbaland.eu'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-correlation-id, x-session-id');
  }

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment ? error.message : 'Something went wrong';

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: errorMessage,
    ...(isDevelopment && { stack: error.stack })
  });
};