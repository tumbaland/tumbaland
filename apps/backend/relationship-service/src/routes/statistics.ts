import express from 'express';
import { getStatistics, getMonthlyHoursData, getMonthlyStatisticsData, getMonthlyActivityBreakdownData, getWeeklyHeatmapDataController, getCumulativeTimelineDataController } from '../controllers/statistics.controller';

const router = express.Router();

/**
 * @route GET /api/statistics
 * @desc Get relationship statistics
 * @query timeframe - Optional: week, month, quarter, year, all (default: all)
 */
router.get('/', getStatistics);

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

/**
 * @route GET /api/statistics/monthly-activity-breakdown
 * @desc Get monthly activity breakdown statistics
 * @query year - Optional: specific year to filter by
 */
router.get('/monthly-activity-breakdown', getMonthlyActivityBreakdownData);

/**
 * @route GET /api/statistics/weekly-heatmap
 * @desc Get weekly heatmap data
 * @query year - Optional: specific year to filter by
 */
router.get('/weekly-heatmap', getWeeklyHeatmapDataController);

/**
 * @route GET /api/statistics/cumulative-timeline
 * @desc Get cumulative timeline data
 * @query year - Optional: specific year to filter by
 */
router.get('/cumulative-timeline', getCumulativeTimelineDataController);

export default router;
