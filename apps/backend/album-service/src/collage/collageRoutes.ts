import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
import * as collageController from './collage.controller';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

router.post('/', collageController.createCollage);
router.put('/:id', collageController.updateCollage);
router.get('/:id', collageController.getCollageById);
// GET /collages?albumId=... to filter by album
router.get('/', collageController.getCollageList);
router.delete('/:id', collageController.deleteCollage);

export default router;
