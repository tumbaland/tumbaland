import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import * as collageController from './collage.controller';
import { createCollageSchema, updateCollageSchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

router.post('/', validate(createCollageSchema), collageController.createCollage);
router.put('/:id', validate(updateCollageSchema), collageController.updateCollage);
// Live editing (changes, presence, moving, the stream) is in
// collageLiveRoutes, mounted ahead of the general rate limiter.
router.get('/:id', collageController.getCollageById);
// GET /collages?albumId=... to filter by album
router.get('/', collageController.getCollageList);
router.delete('/:id', collageController.deleteCollage);

export default router;
