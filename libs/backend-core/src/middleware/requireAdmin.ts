import { Request, Response, NextFunction } from 'express';

/**
 * Lets only an administrator through, after authentication.
 *
 * Reads the role off the session token, which is re-signed with fresh roles at
 * every renewal, so a role granted or taken away applies within minutes rather
 * than at the next sign-in. Routes that change an account (as opposed to
 * reading it) should additionally check the role against the database, which
 * is what auth-service's `requireRole` does.
 *
 * A key or a connected assistant is refused even if the account behind it is an
 * administrator: software acting for the owner is exactly what a trail of what
 * the owner did should be able to tell apart from the owner.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.apiKey || !req.user?.roles?.includes('admin')) {
    res.status(403).json({ success: false, message: 'admin required' });
    return;
  }
  next();
};
