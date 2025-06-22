import { apiClient } from './config';

export interface RelationshipStatistics {
  totalHoursTogether: number;
  sexActivityDays: number;
  totalActivities: number;
  activitiesThisMonth: number;
  avgHoursPerDay: number;
  daysTogether: number;
  mostFrequentActivity: {
    type: string;
    count: number;
  };
  activityBreakdown: {
    type: string;
    count: number;
    totalHours: number;
    percentage: number;
  }[];
  recentTrends: {
    weeklyAverage: number;
    monthlyAverage: number;
    lastWeekHours: number;
    lastMonthHours: number;
  };
  timeframe: {
    startDate: string;
    endDate: string;
    description: string;
  };
}

export interface StatisticsResponse {
  success: boolean;
  data: RelationshipStatistics;
  timeframe: string;
  generatedAt: string;
}

export interface ActivityBreakdownResponse {
  success: boolean;
  data: {
    breakdown: RelationshipStatistics['activityBreakdown'];
    totalActivities: number;
    timeframe: string;
  };
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

/**
 * Get relationship statistics
 * @param timeframe - Optional: 'week', 'month', 'quarter', 'year', 'all' (default: 'all')
 */
export const getStatistics = async (timeframe: string = 'all'): Promise<RelationshipStatistics> => {
  try {
    const response = await apiClient.get<StatisticsResponse>('/statistics', {
      params: { timeframe }
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch statistics');
  }
};

/**
 * Get activity breakdown statistics
 * @param timeframe - Optional: 'week', 'month', 'quarter', 'year', 'all' (default: 'all')
 */
export const getActivityBreakdown = async (timeframe: string = 'all'): Promise<ActivityBreakdownResponse['data']> => {
  try {
    const response = await apiClient.get<ActivityBreakdownResponse>('/statistics/breakdown', {
      params: { timeframe }
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching activity breakdown:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch activity breakdown');
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

export const statisticsApi = {
  getStatistics,
  getActivityBreakdown,
  getMonthlyHours,
  getMonthlyStatistics,
};
