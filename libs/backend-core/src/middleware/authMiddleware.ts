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