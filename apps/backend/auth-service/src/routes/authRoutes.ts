import { Router, Request, Response, NextFunction } from 'express';
import { validateToken, logout, getProfile, verifyAuth } from '../controllers/authController';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.post('/validate', validateToken);
router.post('/logout', logout);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

// Optional auth routes (works with or without token)
router.get('/verify', optionalAuth, verifyAuth);

export default router;
