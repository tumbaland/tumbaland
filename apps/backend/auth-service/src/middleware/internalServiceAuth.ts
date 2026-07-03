import { Request, Response, NextFunction } from 'express';
import { requireEnv } from '@tumbaland/core';

/**
 * Strictly requires a valid internal-service token. Unlike group-service's
 * variant, this endpoint has no user-facing fallback — invalidate-tokens is
 * only ever called service-to-service, so a missing/mismatched token is
 * always rejected rather than falling through to normal auth.
 */
export function requireInternalService(req: Request, res: Response, next: NextFunction): void {
  try {
    const internalToken = req.headers['x-internal-token'];
    const expectedToken = requireEnv('INTERNAL_SERVICE_TOKEN');

    if (!internalToken || internalToken !== expectedToken) {
      res.status(401).json({ success: false, message: 'Invalid or missing internal service token' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ success: false, message: 'Internal service authentication not configured' });
  }
}
