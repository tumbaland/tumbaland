import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
import {
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker,
  searchTrackedTickers
} from '../controllers/trackedTicker.controller';
import { validateBody } from '../validation/validateBody';
import { trackedTickerSchema } from '../validation/schemas';

const router = Router();

// Must be before /:id routes to avoid Express treating "search" as an id
router.get('/search', authenticateToken, searchTrackedTickers);
router.get('/', authenticateToken, getTrackedTickers);
router.post('/', authenticateToken, validateBody(trackedTickerSchema) as any, addTrackedTicker as any);
router.put('/:id', authenticateToken, validateBody(trackedTickerSchema) as any, editTrackedTicker as any);
router.delete('/:id', authenticateToken, removeTrackedTicker);

export default router;
