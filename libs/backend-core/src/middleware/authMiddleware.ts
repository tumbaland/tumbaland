import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env';
import { isAccessTokenClaims } from '../oauth/tokens';
import { UserPayload } from '../types/auth';
import { isCurrentSession } from '../auth/session';
import { currentGroupsOf } from '../groups/membership';

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user info (and its embedded groups) to
 * the request — typed via the global `Express.Request` augmentation in
 * `../types/auth`, no `(req as any)` cast needed.
 *
 * OAuth access tokens are refused outright. They are signed with the same
 * secret, so they verify here, but they mean something this middleware has no
 * way to honour: an assistant acting within scopes, pinned to one tenant.
 * Routes that software may legitimately reach use `authenticateAgent`, which
 * enforces both — so anything still guarded by this one is a person's to do,
 * and letting a token through would be handing an assistant the account.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const JWT_SECRET = requireEnv('JWT_SECRET');
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }

    const claims = jwt.verify(token, JWT_SECRET);
    if (isAccessTokenClaims(claims)) {
      res.status(403).json({
        success: false,
        message: 'This operation requires an interactive session, not a connected assistant'
      });
      return;
    }

    // A signed-out or revoked device keeps a validly signed token; only its
    // session record says it has ended.
    if (!(await isCurrentSession(claims))) {
      res.status(401).json({ success: false, message: 'Session has ended' });
      return;
    }
    // Membership is asked of group-service, not read from the token, so a
    // change applies within seconds rather than at the next renewal.
    const groups = await currentGroupsOf(claims as UserPayload);
    req.user = { ...(claims as UserPayload), groups };
    req.userGroups = groups;
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }
  next();
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
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const JWT_SECRET = requireEnv('JWT_SECRET');
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const claims = jwt.verify(token, JWT_SECRET);
      // An access token is not a session; treated as none, exactly like an
      // expired cookie, so the route still answers with its public form.
      // An ended session is treated as none, like an expired cookie.
      if (!isAccessTokenClaims(claims) && (await isCurrentSession(claims))) {
        const groups = await currentGroupsOf(claims as UserPayload);
        req.user = { ...(claims as UserPayload), groups };
        req.userGroups = groups;
      }
    }
  } catch {
    // Deliberately ignored — see above.
  }
  next();
}
