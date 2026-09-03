import express from 'express';
import { authenticateToken } from '@tumbaland/backend-core';
import {
  getStatistics,
  getMonthlyHoursData,
  getMonthlyStatisticsData,
  getMonthlyActivityBreakdownData,
  getWeeklyHeatmapDataController,
  getCumulativeTimelineDataController,
  getStreaks,
  getMilestonesData,
  getTrendsData
} from '../controllers/statistics.controller';

const router = express.Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

/**
 * @route GET /api/statistics
 * @desc Get relationship statistics
 * @query timeframe - Optional: week, month, quarter, year, all (default: all)
 */
router.get('/', getStatistics);

/**
 * @route GET /api/statistics/streaks
 * @desc Logging streaks and how overdue each activity type is against its own cadence
 * @query groupId - Optional: group to scope to (defaults to personal entries)
 */
router.get('/streaks', getStreaks);

/**
 * @route GET /api/statistics/milestones
 * @desc Round numbers just reached and the next ones coming up
 * @query groupId - Optional: group to scope to (defaults to personal entries)
 */
router.get('/milestones', getMilestonesData);

/**
 * @route GET /api/statistics/trends
 * @desc The last N days against the N before them, per activity type
 * @query groupId - Optional: group to scope to (defaults to personal entries)
 * @query window - Optional: length of each window in days, 7-180 (default: 30)
 */
router.get('/trends', getTrendsData);

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
