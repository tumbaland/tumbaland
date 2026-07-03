import { Router, Request, Response } from 'express';
import { strictRateLimiter, validate, NotFoundError } from '@tumbaland/core';
import { validateToken, logout, verifyAuth, refreshToken, invalidateUserTokens } from '../controllers/authController';
import { getProfile, updateProfile } from '../controllers/profileController';
import { authenticateToken, requireRole, requireApproved } from '../middleware/authMiddleware';
import { requireInternalService } from '../middleware/internalServiceAuth';
import { User } from '../models/User';
import { validateTokenSchema, invalidateTokensSchema, updateProfileSchema, approveUserSchema } from '../validation/schemas';

const router = Router();

// Login route (public) – must remain public so user can obtain token.
// Strictly rate-limited: unauthenticated token issuance is a brute-force target.
router.post('/validate', strictRateLimiter, validate(validateTokenSchema), validateToken);

// Refresh token route (protected)
router.post('/refresh', authenticateToken, requireApproved, refreshToken);

// Protected logout
router.post('/logout', authenticateToken, requireApproved, logout);

// Protected routes
router.get('/profile', authenticateToken, requireApproved, getProfile);
router.put('/profile', authenticateToken, requireApproved, validate(updateProfileSchema), updateProfile);

// Verify route now fully protected
router.get('/verify', authenticateToken, requireApproved, verifyAuth);

// Internal service endpoints for token management — service-to-service only, never user-facing.
router.post('/internal/invalidate-tokens', requireInternalService, validate(invalidateTokensSchema), invalidateUserTokens);

// Admin utilities (manual authorization): mark user approved
router.post(
  '/admin/approve',
  authenticateToken,
  requireApproved,
  requireRole('admin'),
  validate(approveUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { isApproved: true } },
      { new: true }
    );
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.json({ success: true, user });
  }
);

// List users (admin)
router.get(
  '/admin/users',
  authenticateToken,
  requireApproved,
  requireRole('admin'),
  async (_req: Request, res: Response): Promise<void> => {
    const users = await User.find().sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, users });
  }
);

export default router;
