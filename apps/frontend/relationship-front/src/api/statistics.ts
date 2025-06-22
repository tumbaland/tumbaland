import { apiClient } from './config';

export interface RelationshipStatistics {
  totalHoursTogether: number;
  sexActivityDays: number;
  totalActivities: number;
  daysTogether: number;
}

export interface StatisticsResponse {
  success: boolean;
  data: RelationshipStatistics;
  timeframe: string;
  generatedAt: string;
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

export interface MonthlyStatisticsData {
  month: string;
  year: number;
  totalDays: number;
  daysMet: number;
  daysWithSex: number;
  daysNotMet: number;
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
 */
export const getStatistics = async (timeframe: string = 'all'): Promise<RelationshipStatistics> => {
  try {
    const response = await apiClient.get<StatisticsResponse>('/statistics', {
      params: { timeframe }    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch statistics');
  }
};

/**
 * Get monthly hours statistics
 * @param year - Optional: specific year to filter by
 */
export const getMonthlyHours = async (year?: number): Promise<MonthlyHoursData[]> => {
  try {
    const response = await apiClient.get<MonthlyHoursResponse>('/statistics/monthly-hours', {
      params: year ? { year } : {}
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching monthly hours:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch monthly hours');
  }
};

/**
 * Get monthly statistics (days breakdown)
 * @param year - Optional: specific year to filter by
 */
export const getMonthlyStatistics = async (year?: number): Promise<MonthlyStatisticsData[]> => {
  try {
    const response = await apiClient.get<MonthlyStatisticsResponse>('/statistics/monthly-stats', {
      params: year ? { year } : {}
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching monthly statistics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch monthly statistics');
  }
};

/**
 * Get monthly activity breakdown statistics
 * @param year - Optional: specific year to filter by
 */
export const getMonthlyActivityBreakdown = async (year?: number): Promise<MonthlyActivityData[]> => {
  try {
    const response = await apiClient.get<MonthlyActivityBreakdownResponse>('/statistics/monthly-activity-breakdown', {
      params: year ? { year } : {}
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching monthly activity breakdown:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch monthly activity breakdown');
  }
};

/**
 * Get weekly heatmap data
 * @param year - Optional: specific year to filter by
 */
export const getWeeklyHeatmapData = async (year?: number): Promise<WeeklyHeatmapData[]> => {
  try {
    const response = await apiClient.get<WeeklyHeatmapResponse>('/statistics/weekly-heatmap', {
      params: year ? { year } : {}
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching weekly heatmap data:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch weekly heatmap data');
  }
};

/**
 * Get cumulative timeline data
 * @param year - Optional: specific year to filter by
 */
export const getCumulativeTimelineData = async (year?: number): Promise<CumulativeTimelineData[]> => {
  try {
    const response = await apiClient.get<CumulativeTimelineResponse>('/statistics/cumulative-timeline', {
      params: year ? { year } : {}
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching cumulative timeline data:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch cumulative timeline data');
  }
};

export const statisticsApi = {
  getStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData,
};
