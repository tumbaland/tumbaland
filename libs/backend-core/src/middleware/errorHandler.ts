import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../logging/logger';
import { HttpError } from '../errors/HttpError';

interface KnownError {
  statusCode: number;
  name: string;
  message: string;
  /** Extra body fields carried by errors the client must act on (e.g. a 402's meter/limit/upgradeTo). */
  details?: Record<string, unknown>;
}

/**
 * Recognizes error shapes that map to an obvious HTTP status without a
 * controller having to catch and re-throw them: our own typed HttpError
 * hierarchy, plus Mongoose's ValidationError (failed schema validation,
 * e.g. a missing required field) and CastError (e.g. an invalid ObjectId
 * string) — both of which are client mistakes, not server bugs, but throw
 * as plain Mongoose error classes rather than anything of ours.
 */
function classifyError(error: Error): KnownError | null {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, name: error.name, message: error.message, details: error.details };
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return { statusCode: 400, name: error.name, message: error.message };
  }
  return null;
}

/**
 * Global error handler middleware.
 *
 * Controllers throw a typed `HttpError` (BadRequestError, NotFoundError,
 * ForbiddenError, ...) instead of hand-rolling try/catch + string-matching
 * on `error.message` to pick a status code — Express 5 forwards rejected
 * promises from async route handlers here automatically. Anything that
 * isn't a recognized error type is treated as an unexpected bug: logged
 * with its full stack and returned as a generic 500 (no message leak
 * outside development), same as before this file knew about HttpError.
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const known = classifyError(error);

  if (known) {
    // Client errors (4xx) are routine, expected control flow — log without
    // a stack trace at warn level, not as if the service were broken.
    logger.warn('Request failed:', {
      error: known.message,
      statusCode: known.statusCode,
      url: req.url,
      method: req.method,
      correlationId: req.correlationId
    });
  } else {
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    });
  }

  // No CORS headers here. The CORS middleware sets them for an allowed origin
  // before the route runs, so an error response already carries them. This
  // used to add them again for any origin that merely *contained*
  // "tumbaland.eu" or "localhost", which let https://tumbaland.eu.example.com
  // read error responses with the visitor's cookies.

  if (known) {
    res.status(known.statusCode).json({
      // Spread first so a stray details key can't shadow the envelope fields
      // every client already relies on.
      ...known.details,
      success: false,
      error: known.name,
      message: known.message
    });
    return;
  }

  // Don't leak error details in production for unexpected errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment ? error.message : 'Something went wrong';

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: errorMessage,
    ...(isDevelopment && { stack: error.stack })
  });
};
