import express from 'express';
import { getStatistics, getActivityBreakdown, getMonthlyHoursData, getMonthlyStatisticsData } from '../controllers/statistics.controller';

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

/**
 * @route GET /api/statistics/monthly-hours
 * @desc Get monthly hours statistics
 * @query year - Optional: specific year to filter by
 */
router.get('/monthly-hours', getMonthlyHoursData);

/**
 * @route GET /api/statistics/monthly-stats
 * @desc Get monthly statistics (days breakdown)
 * @query year - Optional: specific year to filter by
 */
router.get('/monthly-stats', getMonthlyStatisticsData);

export default router;
