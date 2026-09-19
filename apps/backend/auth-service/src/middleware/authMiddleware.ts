import { Request, Response, NextFunction } from 'express';
import { isAccessTokenClaims, logger } from '@tumbaland/backend-core';
import { verifyJWT, verifyRefreshToken, UserPayload } from '../services/jwtService';
import { User, IUser } from '../models/User';

// req.user's ambient type comes from @tumbaland/backend-core's global Express.Request
// augmentation (see libs/core/src/types/auth.ts). This service's decoded JWT
// payload (services/jwtService.ts) carries extra fields (tokenVersion, roles,
// isApproved) beyond that shared shape, which is fine — it's a superset, so
// assigning it to req.user below is still valid; those extra fields just
// aren't part of req.user's public (cross-service) type and are read off the
// local `decoded`/`dbUser` variables instead.
//
// `dbUser` itself is a local-only Request field (per backend-core's comment),
// so it gets its own local augmentation rather than living in the shared one.
declare global {
  namespace Express {
    interface Request {
      dbUser?: IUser;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }
    const decoded = verifyJWT(token);

    // An OAuth access token verifies here — same secret — and carries an email,
    // so without this it would find a user and be admitted as that person. It
    // is a connected assistant, held to scopes it has no way to state on these
    // routes, and this service is where keys and connections are managed.
    if (isAccessTokenClaims(decoded)) {
      res.status(403).json({
        success: false,
        message: 'This operation requires an interactive session, not a connected assistant'
      });
      return;
    }

    // Check if token version is valid
    const dbUser = await User.findOne({ email: decoded.email.toLowerCase() });
    if (!dbUser) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    // If token version doesn't match, token is invalid
    if (decoded.tokenVersion && decoded.tokenVersion !== dbUser.tokenVersion) {
      res.status(401).json({ success: false, message: 'Token has been invalidated' });
      return;
    }

    req.user = decoded;
    // Mirror backend-core's authenticateToken, which every other service uses:
    // handlers read group membership off `req.userGroups`, and leaving it unset
    // here made it look like the caller belonged to no groups at all.
    req.userGroups = decoded.groups ?? [];

    // attach db user (if needed elsewhere)
    req.dbUser = dbUser;
    next();
  } catch (error) {
    logger.error('Token verification failed', { error: (error as Error)?.message });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * authenticateToken, but an expired or missing access token is renewed from the
 * refresh cookie instead of answering 401.
 *
 * Only on the routes that mint a new access token (/verify, /refresh). Every
 * app checks /verify when it opens, so someone who has not visited for a few
 * days is signed back in there before any other service sees the stale token.
 * req.user comes from the refresh token's claims; groups and roles are left for
 * the handler, which looks them up fresh anyway.
 */
export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken || hasUsableAccessToken(req)) {
    return authenticateToken(req, res, next);
  }

  let claims: UserPayload;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    // Neither token is any good: let authenticateToken give its usual 401.
    return authenticateToken(req, res, next);
  }

  const dbUser = await User.findOne({ email: claims.email.toLowerCase() });
  if (!dbUser) {
    res.status(401).json({ success: false, message: 'User not found' });
    return;
  }
  // Strict, unlike the access-token check: a refresh token always carries a
  // version, and one from before an invalidation must not buy a new session.
  if ((claims.tokenVersion ?? 1) !== dbUser.tokenVersion) {
    res.status(401).json({ success: false, message: 'Token has been invalidated' });
    return;
  }

  req.user = claims;
  req.userGroups = [];
  req.dbUser = dbUser;
  next();
};

const hasUsableAccessToken = (req: Request): boolean => {
  const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  try {
    verifyJWT(token);
    return true;
  } catch {
    return false;
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = verifyJWT(token);
      // Treated as no session at all, the same as an expired cookie — and in
      // particular never upserted, since an access token must not be the thing
      // that creates an account.
      if (isAccessTokenClaims(decoded)) {
        next();
        return;
      }
      req.user = decoded;
      req.userGroups = decoded.groups ?? [];
      // Upsert but do not block on approval
      await User.findOneAndUpdate(
        { email: decoded.email.toLowerCase() },
        {
          $setOnInsert: { email: decoded.email.toLowerCase(), signupMethod: 'google' },
          $set: { lastLoginAt: new Date() }
        },
        { new: true, upsert: true }
      );
    }
    next();
  } catch (error) {
    next();
  }
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dbUser = req.dbUser;
    if (!dbUser || !dbUser.roles || !dbUser.roles.includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
};

// Enforce approval after basic authentication for protected areas; allow only specific endpoints before approval
export const requireApproved = (req: Request, res: Response, next: NextFunction): void => {
  const dbUser = req.dbUser;
  if (!dbUser) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }
  if (!dbUser.isApproved) {
    res.status(403).json({ success: false, message: 'User not approved' });
    return;
  }
  next();
};
