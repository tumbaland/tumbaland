import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user info to request
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
    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}