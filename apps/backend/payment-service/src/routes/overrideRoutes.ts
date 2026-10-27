import { Router } from 'express';
import { authenticateToken as authenticate, requireAdmin, validate } from '@tumbaland/backend-core';
import { listOverrides, getOverride, upsertOverride, deleteOverride } from '../controllers/overrideController';
import { upsertOverrideSchema } from '../validation/schemas';

/**
 * Per-user entitlement adjustments. Admin-only in every direction — a user
 * being able to read their own override would just be a slower way of reading
 * `GET /api/subscriptions/me/entitlements`, which already returns the resolved
 * limits.
 */
const router = Router();

router.get('/', authenticate, requireAdmin, listOverrides);
router.get('/:email', authenticate, requireAdmin, getOverride);
router.put('/:email', authenticate, requireAdmin, validate(upsertOverrideSchema), upsertOverride);
router.delete('/:email', authenticate, requireAdmin, deleteOverride);

export default router;
