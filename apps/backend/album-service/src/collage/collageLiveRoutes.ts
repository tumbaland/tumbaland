import { Router } from 'express';
import { authenticateAgent, authenticateToken, createRateLimiter, requireScope, validate } from '@tumbaland/backend-core';
import * as collageController from './collage.controller';
import { collageChangesSchema, collageMovingSchema, collagePresenceSchema } from '../validation/schemas';

/**
 * The requests an open collage editor makes while two people work on it.
 *
 * Mounted ahead of the general limiter, which allows 300 requests per 15
 * minutes per address. Two people on one home network share an address, and
 * a drag reports its position ten times a second, so that budget would be
 * gone in half a minute and saving would start failing with it. Each kind
 * gets a budget sized to what it really sends instead, still counted per
 * address, and counted before authentication so a flood is stopped either way.
 */
const router = Router();

/** Saves and selection changes: one per edit, a few thousand is an evening. */
const editLimiter = createRateLimiter({ max: 3000 });
/** Positions while dragging: ten a second for each of two people, with room. */
const motionLimiter = createRateLimiter({ max: 20_000 });

// The stream is one request that stays open as long as the editor does.
router.get('/:id/live', authenticateToken, collageController.liveStream);
// An assistant saves through here too, held to the collages it made (see
// applyCollageChanges). The stream, presence and moving are for open editors.
router.post(
  '/:id/changes',
  editLimiter,
  authenticateAgent(),
  requireScope('album:write'),
  validate(collageChangesSchema),
  collageController.applyCollageChanges
);
router.post(
  '/:id/presence',
  editLimiter,
  authenticateToken,
  validate(collagePresenceSchema),
  collageController.setPresence
);
router.post(
  '/:id/moving',
  motionLimiter,
  authenticateToken,
  validate(collageMovingSchema),
  collageController.reportMoving
);

export default router;
