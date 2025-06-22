import express from 'express';
import { getStatistics, getActivityBreakdown, getMonthlyHoursData, getMonthlyStatisticsData, getMonthlyActivityBreakdownData, getWeeklyHeatmapDataController } from '../controllers/statistics.controller';

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

export default router;
