import { Request, Response, NextFunction } from 'express';
import { authenticateToken as coreAuthenticateToken, internalServiceTokenBypass } from '@tumbaland/backend-core';

/**
 * Wraps the shared JWT check with a bypass for internal service-to-service
 * calls, which aren't a user JWT at all.
 *
 * The bypass *verifies the internal token here*. It used to skip JWT
 * verification whenever the `x-internal-token` header was merely present,
 * leaving the real check to `validateInternalServiceToken` mounted downstream
 * in groupRoutes.ts — so any route that didn't mount that second middleware
 * was reachable unauthenticated by sending the header with any value.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  internalServiceTokenBypass(req, res, () => {
    if (req.isInternalService) {
      next();
      return;
    }
    // Answers every failure itself; there is nothing for a caller to catch.
    void coreAuthenticateToken(req, res, next);
  });
}
