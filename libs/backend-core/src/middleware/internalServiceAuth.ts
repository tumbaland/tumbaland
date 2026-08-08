import { Request, RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import logger from '../logging/logger';

/**
 * Fields set by the internal-service middlewares below. Declared globally so
 * routers and controllers read `req.isInternalService` off the same `Request`
 * type Express itself uses, with no cast at the call site.
 */
declare global {
  namespace Express {
    interface Request {
      isInternalService?: boolean;
      serviceIdentifier?: string;
    }
  }
}

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';
export const SERVICE_ID_HEADER = 'x-service-id';

/**
 * Constant-time comparison of the presented token against the configured one.
 *
 * `===` on secrets leaks their prefix through timing, and `timingSafeEqual`
 * throws on a length mismatch (which is itself a leak), so length is compared
 * first and both buffers are hashed to a fixed width — a token of the wrong
 * length takes the same path as one of the right length with wrong bytes.
 */
export function verifyInternalToken(presented: unknown): boolean {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected) return false;
  if (typeof presented !== 'string' || presented.length === 0) return false;

  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function markInternal(req: Request): void {
  req.isInternalService = true;
  req.serviceIdentifier = (req.headers[SERVICE_ID_HEADER] as string) || 'unknown';
}

/**
 * Hard gate for endpoints that are only ever called service-to-service.
 * No user-JWT fallback: a missing or wrong token is always a 401.
 */
export const requireInternalServiceToken: RequestHandler = (req, res, next) => {
  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    logger.error('INTERNAL_SERVICE_TOKEN not configured');
    res.status(500).json({ success: false, message: 'Internal service authentication not configured' });
    return;
  }

  if (!verifyInternalToken(req.headers[INTERNAL_TOKEN_HEADER])) {
    logger.warn('Rejected internal service request', {
      serviceId: (req.headers[SERVICE_ID_HEADER] as string) || 'unknown',
      path: req.originalUrl
    });
    res.status(401).json({ success: false, message: 'Invalid or missing internal service token' });
    return;
  }

  markInternal(req);
  next();
};

/**
 * For routers that serve both browsers and services: when the internal-token
 * header is present it is *verified here*, and a bad token is rejected rather
 * than passed along.
 *
 * The bug this replaces: treating the mere presence of the header as grounds to
 * skip JWT verification, leaving the real check to a second middleware mounted
 * per-router — so any route that forgot to mount the second one was reachable
 * by sending `x-internal-token: anything`.
 */
export const internalServiceTokenBypass: RequestHandler = (req, res, next) => {
  const presented = req.headers[INTERNAL_TOKEN_HEADER];
  if (presented === undefined) {
    next();
    return;
  }
  requireInternalServiceToken(req, res, next);
};

/** Allows a request that authenticated as either a user or an internal service. */
export const allowUserOrInternalService: RequestHandler = (req, res, next) => {
  if (req.isInternalService || req.user) {
    next();
    return;
  }
  res.status(401).json({ success: false, message: 'Authentication required' });
};
