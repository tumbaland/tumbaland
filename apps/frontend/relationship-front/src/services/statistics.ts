import { ApiError, logger } from '@tumbaland/frontend-core';
import { relationshipApi } from './relationshipApi';
import { ApiResponse } from './types';

function statisticsErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export interface TypeStatistics {
  typeId: string;
  slug: string;
  name: string;
  color?: string;
  valueType?: string;
  count: number;
  totalHours: number;
  /** distinct days having at least one entry of this type (within the timeframe) */
  uniqueDays: number;
}

export interface RelationshipStatistics {
  totalHours: number;
  totalActivities: number;
  /** date of the first entry ever logged in this scope (YYYY-MM-DD) */
  firstEntryDate: string | null;
  daysSinceFirstEntry: number;
  /** per-type breakdown; the dashboard decides which types to feature */
  types: TypeStatistics[];
}

export interface StatisticsResponse {
  success: boolean;
  data: RelationshipStatistics;
  timeframe: string;
  generatedAt: string;
}

export interface TypeCadence {
  typeId: string;
  slug: string;
  name: string;
  color?: string;
  /** YYYY-MM-DD of the most recent entry of this type */
  lastDate: string;
  /** whole days between lastDate and today — 0 means logged today */
  daysSince: number;
  /** distinct days this type was ever logged on */
  loggedDays: number;
  /** mean gap between consecutive logged days; null until there are two of them */
  typicalGapDays: number | null;
  /** daysSince measured against this type's own rhythm; 1 means exactly due */
  overdueRatio: number | null;
}

export interface StreakStatistics {
  /** consecutive logged days ending today or yesterday; 0 once the chain breaks */
  currentStreak: number;
  longestStreak: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  totalLoggedDays: number;
  lastEntryDate: string | null;
  daysSinceLastEntry: number | null;
  /** one row per type ever logged, most overdue first */
  types: TypeCadence[];
}

export type MilestoneKind = 'days-together' | 'anniversary' | 'type-count' | 'total-count';

export interface Milestone {
  kind: MilestoneKind;
  /** stable across refreshes, so it can key a list */
  key: string;
  label: string;
  target: number;
  unit: 'days' | 'years' | 'entries';
  typeId?: string;
  color?: string;
  /** reached milestones: the day it happened, and how long ago that was */
  achievedOn?: string;
  daysAgo?: number;
  /** upcoming count milestones: how many more entries it takes */
  remaining?: number;
  /** upcoming: the exact day for date milestones, the projected day for counts */
  expectedOn?: string;
  daysAway?: number;
  /** true when expectedOn is projected from the current pace rather than certain */
  projected?: boolean;
}

export interface MilestonesResult {
  /** the day the "together" counts run from: the configured start, else the first entry */
  since: string | null;
  daysTogether: number | null;
  /** reached recently, most recent first */
  recent: Milestone[];
  /** expected soon, soonest first */
  upcoming: Milestone[];
}

/** How a window compares to the one before it. */
export type TrendDirection = 'up' | 'down' | 'flat' | 'new' | 'stopped';

export interface TrendTotals {
  entries: number;
  hours: number;
  /** distinct days carrying at least one entry inside the window */
  activeDays: number;
}

export interface TypeTrend {
  typeId: string;
  slug: string;
  name: string;
  color?: string;
  valueType?: string;
  current: TrendTotals;
  previous: TrendTotals;
  entriesDelta: number;
  hoursDelta: number;
  activeDaysDelta: number;
  /** percent change against the previous window; null when there is no baseline */
  entriesChangePct: number | null;
  hoursChangePct: number | null;
  direction: TrendDirection;
}

export interface TrendsResult {
  windowDays: number;
  /** YYYY-MM-DD bounds, both inclusive */
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  totals: Omit<TypeTrend, 'typeId' | 'slug' | 'name' | 'color' | 'valueType'>;
  /** one row per type logged in either window, biggest mover first */
  types: TypeTrend[];
}

export interface MonthlyHoursData {
  month: string;
  year: number;
  hours: number;
  activities: number;
}

export interface MonthlyHoursResponse {
  success: boolean;
  data: MonthlyHoursData[];
  generatedAt: string;
}

export interface MonthlyTypeStatistics {
  slug: string;
  count: number;
  uniqueDays: number;
}

export interface MonthlyStatisticsData {
  month: string;
  year: number;
  totalDays: number;
  /** distinct days in the month with at least one entry of any type */
  daysWithEntries: number;
  types: MonthlyTypeStatistics[];
}

export interface MonthlyStatisticsResponse {
  success: boolean;
  data: MonthlyStatisticsData[];
  generatedAt: string;
}

export interface MonthlyActivityData {
  month: string;
  year: number;
  activities: {
    [key: string]: {
      count: number;
      hours: number;
    };
  };
  totalHours: number;
  totalActivities: number;
}

export interface MonthlyActivityBreakdownResponse {
  success: boolean;
  data: MonthlyActivityData[];
  generatedAt: string;
}

export interface WeeklyHeatmapData {
  date: string; // YYYY-MM-DD format
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  week: number; // Week number in the year
  month: number;
  year: number;
  totalActivities: number;
  totalHours: number;
  activities: {
    [key: string]: {
      count: number;
      hours: number;
    };
  };
}

export interface WeeklyHeatmapResponse {
  success: boolean;
  data: WeeklyHeatmapData[];
  generatedAt: string;
}

export interface CumulativeTimelineData {
  date: string; // YYYY-MM-DD format
  dailyActivities: number;
  cumulativeActivities: number;
  dailyHours: number;
  cumulativeHours: number;
  activityBreakdown: {
    [key: string]: {
      dailyCount: number;
      cumulativeCount: number;
    };
  };
}

export interface CumulativeTimelineResponse {
  success: boolean;
  data: CumulativeTimelineData[];
  generatedAt: string;
}

/**
 * Get relationship statistics
 * @param timeframe - Optional: 'week', 'month', 'quarter', 'year', 'all' (default: 'all')
 * @param groupId - Optional: group ID to filter by
 */
export const getStatistics = async (timeframe: string = 'all', groupId?: string): Promise<RelationshipStatistics> => {
  try {
    const params: Record<string, string | number> = { timeframe };
    if (groupId) {
      params.groupId = groupId;
    }

    const response = await relationshipApi.get<ApiResponse<RelationshipStatistics>>('/statistics', {
      params
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching statistics', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch statistics'));
  }
};

/**
 * Get logging streaks and per-type staleness. Never timeframe-scoped: "last
 * time" only means anything against the whole history.
 * @param groupId - Optional: group ID to filter by
 */
export const getStreaks = async (groupId?: string): Promise<StreakStatistics> => {
  try {
    const params: Record<string, string | number> = {};
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<StreakStatistics>>('/statistics/streaks', {
      params
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching streaks', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch streaks'));
  }
};

/**
 * Get milestones just reached and coming up. Like streaks this is never
 * timeframe-scoped, and the server applies the scope's dashboard settings
 * (start date, hidden types) so the numbers match the rest of the dashboard.
 * @param groupId - Optional: group ID to filter by
 */
export const getMilestones = async (groupId?: string): Promise<MilestonesResult> => {
  try {
    const params: Record<string, string | number> = {};
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<MilestonesResult>>('/statistics/milestones', {
      params
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching milestones', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch milestones'));
  }
};

/**
 * Get the last `windowDays` days against the window before them. The server
 * applies the scope's hidden types, so the rows match the rest of the dashboard.
 * @param windowDays - Optional: length of each window in days, 7-180 (default: 30)
 * @param groupId - Optional: group ID to filter by
 */
export const getTrends = async (windowDays?: number, groupId?: string): Promise<TrendsResult> => {
  try {
    const params: Record<string, string | number> = {};
    if (windowDays) params.window = windowDays;
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<TrendsResult>>('/statistics/trends', {
      params
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching trends', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch trends'));
  }
};

/**
 * Get monthly hours statistics
 * @param year - Optional: specific year to filter by
 * @param groupId - Optional: group ID to filter by
 */
export const getMonthlyHours = async (year?: number, groupId?: string): Promise<MonthlyHoursData[]> => {
  try {
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<MonthlyHoursData[]>>('/statistics/monthly-hours', {
      params: Object.keys(params).length > 0 ? params : {}
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching monthly hours', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch monthly hours'));
  }
};

/**
 * Get monthly statistics (days breakdown)
 * @param year - Optional: specific year to filter by
 * @param groupId - Optional: group ID to filter by
 */
export const getMonthlyStatistics = async (year?: number, groupId?: string): Promise<MonthlyStatisticsData[]> => {
  try {
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<MonthlyStatisticsData[]>>('/statistics/monthly-stats', {
      params: Object.keys(params).length > 0 ? params : {}
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching monthly statistics', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch monthly statistics'));
  }
};

/**
 * Get monthly activity breakdown statistics
 * @param year - Optional: specific year to filter by
 * @param groupId - Optional: group ID to filter by
 */
export const getMonthlyActivityBreakdown = async (year?: number, groupId?: string): Promise<MonthlyActivityData[]> => {
  try {
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<MonthlyActivityData[]>>('/statistics/monthly-activity-breakdown', {
      params: Object.keys(params).length > 0 ? params : {}
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching monthly activity breakdown', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch monthly activity breakdown'));
  }
};

/**
 * Get weekly heatmap data
 * @param year - Optional: specific year to filter by
 * @param groupId - Optional: group ID to filter by
 */
export const getWeeklyHeatmapData = async (year?: number, groupId?: string): Promise<WeeklyHeatmapData[]> => {
  try {
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<WeeklyHeatmapData[]>>('/statistics/weekly-heatmap', {
      params: Object.keys(params).length > 0 ? params : {}
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching weekly heatmap data', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch weekly heatmap data'));
  }
};

/**
 * Get cumulative timeline data
 * @param year - Optional: specific year to filter by
 * @param groupId - Optional: group ID to filter by
 */
export const getCumulativeTimelineData = async (year?: number, groupId?: string): Promise<CumulativeTimelineData[]> => {
  try {
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;

    const response = await relationshipApi.get<ApiResponse<CumulativeTimelineData[]>>('/statistics/cumulative-timeline', {
      params: Object.keys(params).length > 0 ? params : {}
    });
    return response.data;
  } catch (error) {
    logger.error('Error fetching cumulative timeline data', error);
    throw new Error(statisticsErrorMessage(error, 'Failed to fetch cumulative timeline data'));
  }
};

export const statisticsApi = {
  getStatistics,
  getStreaks,
  getMilestones,
  getTrends,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData
};
