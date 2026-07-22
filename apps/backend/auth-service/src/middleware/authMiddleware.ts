import { Request, Response, NextFunction } from 'express';
import { logger } from '@tumbaland/backend-core';
import { verifyJWT } from '../services/jwtService';
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

    // attach db user (if needed elsewhere)
    req.dbUser = dbUser;
    next();
  } catch (error) {
    logger.error('Token verification failed', { error: (error as Error)?.message });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = verifyJWT(token);
      req.user = decoded;
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
