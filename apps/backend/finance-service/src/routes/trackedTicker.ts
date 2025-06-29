import { Router } from 'express';
import {
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker
} from '../controllers/trackedTicker.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { validateBody } from '../validation/validateBody';
import { trackedTickerSchema } from '../validation/schemas';

const router = Router();

router.get('/', authenticateToken, getTrackedTickers);
router.post('/', authenticateToken, validateBody(trackedTickerSchema) as any, addTrackedTicker as any);
router.put('/:id', authenticateToken, validateBody(trackedTickerSchema) as any, editTrackedTicker as any);
router.delete('/:id', authenticateToken, removeTrackedTicker);

export default router;
