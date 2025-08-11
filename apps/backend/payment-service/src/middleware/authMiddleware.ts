import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtUser {
  email: string;
  name?: string;
  [k: string]: any;
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ success: false, message: 'token required' });
      return;
    }
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const decoded = jwt.verify(token, secret) as JwtUser;
    if (!decoded.email) {
      res.status(401).json({ success: false, message: 'invalid token' });
      return;
    }
    (req as any).user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ success: false, message: 'unauthorized' });
  }
};
