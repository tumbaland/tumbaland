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
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData
};
