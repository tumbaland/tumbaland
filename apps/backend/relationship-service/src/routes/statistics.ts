import express from 'express';
import {
  getStatistics,
  getMonthlyHoursData,
  getMonthlyStatisticsData,
  getMonthlyActivityBreakdownData,
  getWeeklyHeatmapDataController,
  getCumulativeTimelineDataController
} from '../controllers/statistics.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @route GET /api/statistics
 * @desc Get relationship statistics
 * @query timeframe - Optional: week, month, quarter, year, all (default: all)
 */
router.get('/', authenticateToken, getStatistics);

/**
 * @route GET /api/statistics/monthly-hours
 * @desc Get monthly hours statistics
 * @query year - Optional: specific year to filter by
 */
router.get('/monthly-hours', authenticateToken, getMonthlyHoursData);

/**
 * @route GET /api/statistics/monthly-stats
 * @desc Get monthly statistics (days breakdown)
 * @query year - Optional: specific year to filter by
 */
router.get('/monthly-stats', authenticateToken, getMonthlyStatisticsData);

/**
 * @route GET /api/statistics/monthly-activity-breakdown
 * @desc Get monthly activity breakdown statistics
 * @query year - Optional: specific year to filter by
 */
router.get('/monthly-activity-breakdown', authenticateToken, getMonthlyActivityBreakdownData);

/**
 * @route GET /api/statistics/weekly-heatmap
 * @desc Get weekly heatmap data
 * @query year - Optional: specific year to filter by
 */
router.get('/weekly-heatmap', authenticateToken, getWeeklyHeatmapDataController);

/**
 * @route GET /api/statistics/cumulative-timeline
 * @desc Get cumulative timeline data
 * @query year - Optional: specific year to filter by
 */
router.get('/cumulative-timeline', authenticateToken, getCumulativeTimelineDataController);

export default router;
