import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError } from '@tumbaland/backend-core';
import {
  getRelationshipStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData,
  getStreakStatistics,
  getMilestones,
  getTrends,
  StatisticsFilters
} from '../services/statistics.service';
import { getDashboardSettings } from '../services/dashboardSettings.service';

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
    // A named group is not taken on trust. Milestones and trends were covered by
    // the dashboard-settings read in front of them; every other statistics
    // endpoint handed any group's figures to anyone who named it.
    if (!(req.userGroups || []).includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
    }
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
 * Round numbers just reached and just ahead.
 *
 * Reads the scope's dashboard settings first: the same start date the
 * days-together card counts from decides when an anniversary falls, and types
 * hidden from the dashboard stay out of the milestones too, so the two views
 * never disagree about what counts.
 */
export const getMilestonesData = async (req: Request, res: Response): Promise<void> => {
  const { groupId } = req.query;
  const settings = await getDashboardSettings(
    req.user!.id,
    req.userGroups || [],
    groupId as string | undefined
  );

  const milestones = await getMilestones(scopeFilters(req), {
    startDate: settings.startDate,
    hiddenTypeIds: settings.hiddenTypeIds
  });

  res.json({
    success: true,
    data: milestones,
    generatedAt: new Date().toISOString()
  });
};

const MIN_TREND_WINDOW = 7;
const MAX_TREND_WINDOW = 180;

/**
 * How the last window compares to the one before it.
 *
 * Reads the scope's dashboard settings for the same reason the milestones
 * endpoint does: a type hidden from the dashboard should not turn up here as
 * the week's biggest mover.
 */
export const getTrendsData = async (req: Request, res: Response): Promise<void> => {
  const { groupId, window } = req.query;

  let windowDays = 30;
  if (window) {
    windowDays = parseInt(window as string);
    if (isNaN(windowDays) || windowDays < MIN_TREND_WINDOW || windowDays > MAX_TREND_WINDOW) {
      throw new BadRequestError(
        `Window must be a number of days between ${MIN_TREND_WINDOW} and ${MAX_TREND_WINDOW}`
      );
    }
  }

  const settings = await getDashboardSettings(
    req.user!.id,
    req.userGroups || [],
    groupId as string | undefined
  );

  const trends = await getTrends(scopeFilters(req), {
    windowDays,
    hiddenTypeIds: settings.hiddenTypeIds
  });

  res.json({
    success: true,
    data: trends,
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
