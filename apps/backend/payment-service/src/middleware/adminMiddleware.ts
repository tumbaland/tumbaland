import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.roles?.includes('admin')) {
    res.status(403).json({ success: false, message: 'admin required' });
    return;
  }
  next();
};
