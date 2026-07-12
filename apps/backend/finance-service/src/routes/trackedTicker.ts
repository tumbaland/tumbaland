import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker,
  searchTrackedTickers
} from '../controllers/trackedTicker.controller';
import { createTrackedTickerSchema, updateTrackedTickerSchema } from '../validation/schemas';

const router = Router();

// Must be before /:id routes to avoid Express treating "search" as an id
router.get('/search', authenticateToken, searchTrackedTickers);
router.get('/', authenticateToken, getTrackedTickers);
router.post('/', authenticateToken, validate(createTrackedTickerSchema), addTrackedTicker);
router.put('/:id', authenticateToken, validate(updateTrackedTickerSchema), editTrackedTicker);
router.delete('/:id', authenticateToken, removeTrackedTicker);

export default router;
