import { Router } from 'express';
import { authenticateAgent, requireScope, validate, createRateLimiter } from '@tumbaland/backend-core';
import {
  getTickerPriceHistory,
  fetchAndSaveTickerPrices,
  deleteTickerPriceHistory,
  fetchAndSaveAllTickerHistory,
  fetchAndSaveWeeklyTickerHistory,
  getCoverage,
  getQuota
} from '../controllers/tickerPriceHistory.controller';
import { tickerFetchSchema } from '../validation/schemas';
import { DAILY_LIMIT } from '../services/apiQuota.service';

const router = Router();

/**
 * Every route below that reaches Alpha Vantage spends one call from a daily
 * quota shared by the whole deployment, so they get a much tighter limit than
 * ordinary reads: without it a single user holding down a refresh button
 * exhausts the day for everyone.
 *
 * The cap matches the provider's own daily allowance, applied per client per
 * hour — so no single client can spend more in an hour than the whole
 * deployment gets in a day, while `consumeQuota` remains the hard limit.
 */
const providerCallLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: DAILY_LIMIT });

// Fetch and save all historic prices for a ticker
router.post(
  '/fetch-all',
  authenticateAgent(),
  requireScope('finance:write'),
  providerCallLimiter,
  validate(tickerFetchSchema),
  fetchAndSaveAllTickerHistory
);

// Fetch and save the full weekly history for a ticker (one call, ~10-20 years)
router.post(
  '/fetch-weekly',
  authenticateAgent(),
  requireScope('finance:write'),
  providerCallLimiter,
  validate(tickerFetchSchema),
  fetchAndSaveWeeklyTickerHistory
);

// Get price history for the caller's tracked tickers
router.get('/', authenticateAgent(), requireScope('finance:read'), getTickerPriceHistory);
// Remaining provider quota for today
router.get('/quota', authenticateAgent(), requireScope('finance:read'), getQuota);
// How much history each tracked ticker holds, and how fresh it is
router.get('/coverage', authenticateAgent(), requireScope('finance:read'), getCoverage);
// Fetch and save latest prices
router.post(
  '/fetch',
  authenticateAgent(),
  requireScope('finance:write'),
  providerCallLimiter,
  validate(tickerFetchSchema),
  fetchAndSaveTickerPrices
);
// Delete a price history record by id
router.delete('/:id', authenticateAgent(), requireScope('finance:write'), deleteTickerPriceHistory);

export default router;
