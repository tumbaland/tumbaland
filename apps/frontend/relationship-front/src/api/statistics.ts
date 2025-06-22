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

export const statisticsApi = {
  getStatistics,
  getActivityBreakdown,
};
