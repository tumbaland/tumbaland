import { Request, Response, NextFunction } from 'express';
import { authenticateToken as coreAuthenticateToken } from '@tumbaland/core';

/**
 * Wraps the shared JWT check with a bypass for internal service-to-service
 * calls (identified by the x-internal-token header) — those aren't a user
 * JWT at all, and are authenticated separately by validateInternalServiceToken
 * in internalServiceAuth.ts, mounted downstream in groupRoutes.ts.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-internal-token']) {
    next();
    return;
  }
  coreAuthenticateToken(req, res, next);
}
