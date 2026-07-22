import { Request, Response, NextFunction, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Middleware to add correlation ID to requests
 * Adds correlation ID to request object and response headers
 */
export const correlationMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  next();
};