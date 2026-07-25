import { Request, RequestHandler } from 'express';
import { logger } from '@tumbaland/backend-core';

/**
 * Extends the `Express.Request` augmentation from `@tumbaland/backend-core`
 * (which already adds `user`/`userGroups`) with the two fields specific to
 * group-service's internal-service bypass. Declared on the global `Request`
 * type — not a local subtype — so these middlewares and the controllers that
 * read `req.isInternalService` all type-check against the same `Request`
 * Express itself uses, with no cast needed at the route-mounting call site.
 */
declare global {
  namespace Express {
    interface Request {
      isInternalService?: boolean;
      serviceIdentifier?: string;
    }
  }
}

/** @deprecated Kept for existing imports; the fields now live on `Request` directly. */
export type InternalServiceRequest = Request;

/**
 * Middleware to validate internal service tokens for inter-service communication
 */
export const validateInternalServiceToken: RequestHandler = (req, res, next) => {
  const internalToken = req.headers['x-internal-token'] as string;
  const serviceId = req.headers['x-service-id'] as string;

  // Check if this is an internal service request
  if (internalToken) {
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

    if (!expectedToken) {
      logger.error('INTERNAL_SERVICE_TOKEN not configured');
      res.status(500).json({
        success: false,
        message: 'Internal service authentication not configured'
      });
      return;
    }

    if (internalToken !== expectedToken) {
      logger.error('Invalid internal service token', { serviceId: serviceId || 'unknown service' });
      res.status(401).json({
        success: false,
        message: 'Invalid internal service token'
      });
      return;
    }

    // Mark as internal service request
    req.isInternalService = true;
    req.serviceIdentifier = serviceId || 'unknown';

    logger.info('Internal service authenticated', { serviceIdentifier: req.serviceIdentifier });
    next();
    return;
  }

  // If no internal token, continue with normal auth flow
  next();
};

/**
 * Middleware that allows either authenticated users OR internal services
 */
export const allowUserOrInternalService: RequestHandler = (req, res, next) => {
  // If already authenticated as internal service, allow
  if (req.isInternalService) {
    next();
    return;
  }

  // Otherwise, require user authentication
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  next();
};
