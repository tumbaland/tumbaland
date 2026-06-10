import { Router } from 'express';
import {
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker,
  searchTrackedTickers
} from '../controllers/trackedTicker.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { userGroupsMiddleware } from '../middleware/userGroupsMiddleware';
import { validateBody } from '../validation/validateBody';
import { trackedTickerSchema } from '../validation/schemas';

const router = Router();

// Must be before /:id routes to avoid Express treating "search" as an id
router.get('/search', authenticateToken, searchTrackedTickers);
router.get('/', authenticateToken, userGroupsMiddleware, getTrackedTickers);
router.post('/', authenticateToken, userGroupsMiddleware, validateBody(trackedTickerSchema) as any, addTrackedTicker as any);
router.put('/:id', authenticateToken, userGroupsMiddleware, validateBody(trackedTickerSchema) as any, editTrackedTicker as any);
router.delete('/:id', authenticateToken, userGroupsMiddleware, removeTrackedTicker);

export default router;
