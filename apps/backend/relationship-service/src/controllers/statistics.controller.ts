import { Request, Response } from 'express';
import { BadRequestError } from '@tumbaland/backend-core';
import {
  getRelationshipStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData,
  getStreakStatistics,
  StatisticsFilters
} from '../services/statistics.service';

function parseYearParam(year: unknown): number | undefined {
  if (!year) return undefined;

  const selectedYear = parseInt(year as string);
  if (isNaN(selectedYear) || selectedYear < 2000 || selectedYear > new Date().getFullYear() + 1) {
    throw new BadRequestError('Year must be a valid number between 2000 and next year');
  }

  return selectedYear;
}

/**
 * A request's scope: the named group, or — with no `groupId` — the caller's own
 * entries only. Every statistics endpoint scopes the same way, so the dashboard
 * never mixes a group's numbers into a personal view.
 */
function scopeFilters(req: Request): StatisticsFilters {
  const { groupId } = req.query;
  const filters: StatisticsFilters = { userId: req.user!.id };

  if (groupId) {
    filters.groupId = groupId as string;
  } else {
    filters.userGroupIds = req.userGroups || [];
    filters.personalOnly = true;
  }

  return filters;
}

/**
 * Get relationship statistics
 */
export const getStatistics = async (req: Request, res: Response): Promise<void> => {
  const { timeframe } = req.query;

  const validTimeframes = ['week', 'month', 'quarter', 'year', 'all'];
  const selectedTimeframe = (timeframe as string) || 'all';
  if (!validTimeframes.includes(selectedTimeframe)) {
    throw new BadRequestError('Invalid timeframe. Must be one of: week, month, quarter, year, all');
  }

  const filters = scopeFilters(req);

  const statistics = await getRelationshipStatistics(selectedTimeframe, filters);

  res.json({
    success: true,
    data: statistics,
    timeframe: selectedTimeframe,
    generatedAt: new Date().toISOString()
  });
};

/**
 * Get logging streaks and per-type staleness
 */
export const getStreaks = async (req: Request, res: Response): Promise<void> => {
  const streaks = await getStreakStatistics(scopeFilters(req));

  res.json({
    success: true,
    data: streaks,
    generatedAt: new Date().toISOString()
  });
};

/**
 * Get monthly hours statistics
 */
export const getMonthlyHoursData = async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query;
  const filters = scopeFilters(req);
  const selectedYear = parseYearParam(year);

  const monthlyHours = await getMonthlyHours(selectedYear, filters);

  res.json({
    success: true,
    data: monthlyHours,
    generatedAt: new Date().toISOString()
  });
};

/**
 * Get monthly statistics (days breakdown)
 */
export const getMonthlyStatisticsData = async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query;
  const filters = scopeFilters(req);
  const selectedYear = parseYearParam(year);

  const monthlyStats = await getMonthlyStatistics(selectedYear, filters);

  res.json({
    success: true,
    data: monthlyStats,
    generatedAt: new Date().toISOString()
  });
};

/**
 * Get monthly activity breakdown
 */
export const getMonthlyActivityBreakdownData = async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query;
  const filters = scopeFilters(req);
  const selectedYear = parseYearParam(year);

  const monthlyActivityData = await getMonthlyActivityBreakdown(selectedYear, filters);

  res.json({
    success: true,
    data: monthlyActivityData,
    generatedAt: new Date().toISOString()
  });
};

/**
 * Get weekly heatmap data
 */
export const getWeeklyHeatmapDataController = async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query;
  const filters = scopeFilters(req);
  const selectedYear = parseYearParam(year);

  const heatmapData = await getWeeklyHeatmapData(selectedYear, filters);

  res.json({
    success: true,
    data: heatmapData,
    generatedAt: new Date().toISOString()
  });
};

/**
 * Get cumulative timeline data
 */
export const getCumulativeTimelineDataController = async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query;
  const filters = scopeFilters(req);
  const selectedYear = parseYearParam(year);

  const timelineData = await getCumulativeTimelineData(selectedYear, filters);

  res.json({
    success: true,
    data: timelineData,
    generatedAt: new Date().toISOString()
  });
};
