import express from 'express';
import { getStatistics, getActivityBreakdown } from '../controllers/statistics.controller';

const router = express.Router();

/**
 * @route GET /api/statistics
 * @desc Get relationship statistics
 * @query timeframe - Optional: week, month, quarter, year, all (default: all)
 */
router.get('/', getStatistics);

/**
 * @route GET /api/statistics/breakdown
 * @desc Get activity breakdown statistics
 * @query timeframe - Optional: week, month, quarter, year, all (default: all)
 */
router.get('/breakdown', getActivityBreakdown);

export default router;
