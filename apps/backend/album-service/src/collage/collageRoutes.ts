import { Router } from 'express';
import * as collageController from './collage.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, collageController.createCollage);
router.put('/:id', authenticateToken, collageController.updateCollage);
router.get('/:id', authenticateToken, collageController.getCollageById);
// GET /collages?albumId=... to filter by album
router.get('/', authenticateToken, collageController.getCollageList);
router.delete('/:id', authenticateToken, collageController.deleteCollage);

export default router;
