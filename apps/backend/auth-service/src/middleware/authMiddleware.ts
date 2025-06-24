import { Request, Response, NextFunction } from 'express';
import { verifyJWT, UserPayload } from '../services/jwtService';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check for token in cookies first, then Authorization header
    const token = req.cookies?.access_token || 
                 req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }

    const user = verifyJWT(token);
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.access_token || 
                 req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const user = verifyJWT(token);
      req.user = user;
    }
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};
