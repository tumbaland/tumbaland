import { Router } from 'express';
import {
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker
} from '../controllers/trackedTicker.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { userGroupsMiddleware } from '../middleware/userGroupsMiddleware';
import { validateBody } from '../validation/validateBody';
import { trackedTickerSchema } from '../validation/schemas';

const router = Router();

router.get('/', authenticateToken, userGroupsMiddleware, getTrackedTickers);
router.post('/', authenticateToken, userGroupsMiddleware, validateBody(trackedTickerSchema) as any, addTrackedTicker as any);
router.put('/:id', authenticateToken, userGroupsMiddleware, validateBody(trackedTickerSchema) as any, editTrackedTicker as any);
router.delete('/:id', authenticateToken, userGroupsMiddleware, removeTrackedTicker);

export default router;
