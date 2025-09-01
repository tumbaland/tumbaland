import { Router } from 'express';
import * as collageController from './collage.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { userGroupsMiddleware } from '../middleware/userGroupsMiddleware';

const router = Router();

// Apply authentication and user groups middleware to all routes
router.use(authenticateToken);
router.use(userGroupsMiddleware);

router.post('/', collageController.createCollage);
router.put('/:id', collageController.updateCollage);
router.get('/:id', collageController.getCollageById);
// GET /collages?albumId=... to filter by album
router.get('/', collageController.getCollageList);
router.delete('/:id', collageController.deleteCollage);

export default router;
