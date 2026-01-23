import { relationshipApi } from '../config/relationshipApi';

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
  daysTogether: number;
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
 * @param groupId - Optional: group ID to filter by
 */
export const getStatistics = async (timeframe: string = 'all', groupId?: string): Promise<RelationshipStatistics> => {
  try {
    const params: Record<string, any> = { timeframe };
    if (groupId) {
      params.groupId = groupId;
    }
    
    const response = await relationshipApi.get('/statistics', {
      params
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch statistics');
  }
};

/**
 * Get monthly hours statistics
 * @param year - Optional: specific year to filter by
 * @param groupId - Optional: group ID to filter by
 */
export const getMonthlyHours = async (year?: number, groupId?: string): Promise<MonthlyHoursData[]> => {
  try {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;
    
    const response = await relationshipApi.get('/statistics/monthly-hours', {
      params: Object.keys(params).length > 0 ? params : {}
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
 * @param groupId - Optional: group ID to filter by
 */
export const getMonthlyStatistics = async (year?: number, groupId?: string): Promise<MonthlyStatisticsData[]> => {
  try {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;
    
    const response = await relationshipApi.get('/statistics/monthly-stats', {
      params: Object.keys(params).length > 0 ? params : {}
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
 * @param groupId - Optional: group ID to filter by
 */
export const getMonthlyActivityBreakdown = async (year?: number, groupId?: string): Promise<MonthlyActivityData[]> => {
  try {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;
    
    const response = await relationshipApi.get('/statistics/monthly-activity-breakdown', {
      params: Object.keys(params).length > 0 ? params : {}
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
 * @param groupId - Optional: group ID to filter by
 */
export const getWeeklyHeatmapData = async (year?: number, groupId?: string): Promise<WeeklyHeatmapData[]> => {
  try {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;
    
    const response = await relationshipApi.get('/statistics/weekly-heatmap', {
      params: Object.keys(params).length > 0 ? params : {}
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
 * @param groupId - Optional: group ID to filter by
 */
export const getCumulativeTimelineData = async (year?: number, groupId?: string): Promise<CumulativeTimelineData[]> => {
  try {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    if (groupId) params.groupId = groupId;
    
    const response = await relationshipApi.get('/statistics/cumulative-timeline', {
      params: Object.keys(params).length > 0 ? params : {}
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
  getCumulativeTimelineData
};
