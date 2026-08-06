import { Router } from 'express';
import { authenticateToken, validate, createRateLimiter } from '@tumbaland/backend-core';
import {
  getTrackedTickers,
  addTrackedTicker,
  editTrackedTicker,
  removeTrackedTicker,
  searchTrackedTickers
} from '../controllers/trackedTicker.controller';
import { createTrackedTickerSchema, updateTrackedTickerSchema } from '../validation/schemas';
import { DAILY_LIMIT } from '../services/apiQuota.service';

const router = Router();

// Symbol search costs one call from the deployment-wide daily Alpha Vantage
// quota, so it is limited far below the baseline for ordinary reads: the
// provider's own daily allowance, per client per hour.
const searchLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: DAILY_LIMIT });

// Must be before /:id routes to avoid Express treating "search" as an id
router.get('/search', authenticateToken, searchLimiter, searchTrackedTickers);
router.get('/', authenticateToken, getTrackedTickers);
router.post('/', authenticateToken, validate(createTrackedTickerSchema), addTrackedTicker);
router.put('/:id', authenticateToken, validate(updateTrackedTickerSchema), editTrackedTicker);
router.delete('/:id', authenticateToken, removeTrackedTicker);

export default router;
