import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env';
import { UserPayload } from '../types/auth';

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user info (and its embedded groups) to
 * the request — typed via the global `Express.Request` augmentation in
 * `../types/auth`, no `(req as any)` cast needed.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const JWT_SECRET = requireEnv('JWT_SECRET');
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }

    const user = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = user;
    req.userGroups = user.groups ?? [];
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
/**
 * Attaches the user when a valid token is present, and never rejects.
 *
 * For routes whose response is public but *richer* when signed in — the plan
 * catalog is the case this exists for: a signed-out visitor on the landing
 * page must be able to read prices, while a signed-in one additionally gets
 * the hidden plan they are actually on.
 *
 * An invalid or expired token is treated as no token rather than as a 401. The
 * caller asked for public data; refusing it because a stale cookie is lying
 * around would break the landing page for exactly the people most likely to
 * have one.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const JWT_SECRET = requireEnv('JWT_SECRET');
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const user = jwt.verify(token, JWT_SECRET) as UserPayload;
      req.user = user;
      req.userGroups = user.groups ?? [];
    }
  } catch {
    // Deliberately ignored — see above.
  }
  next();
}
