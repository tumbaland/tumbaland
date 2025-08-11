import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user: any = (req as any).user;
  if (!user || (user.role !== 'admin' && user.isAdmin !== true)) {
    res.status(403).json({ success: false, message: 'admin required' });
    return;
  }
  next();
};
