// Activity Types based on backend model
export interface Activity {
  _id?: string;
  id?: string;
  date: Date | string;
  hours: number;
  activity: {
    type: ActivityType;
    description: string;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type ActivityType = 
  | 'movies' 
  | 'cooking' 
  | 'coffee'
  | 'gaming' 
  | 'other' 
  | 'sex' 
  | 'together';

export interface CreateActivityRequest {
  date: Date | string;
  hours?: number;
  activity: {
    type: ActivityType;
    description?: string;
  };
}

export interface UpdateActivityRequest extends Partial<CreateActivityRequest> {}

export interface GetActivitiesFilters {
  activityType?: ActivityType;
  startDate?: Date | string;
  endDate?: Date | string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityStats {
  totalActivities: number;
  totalHours: number;
  averageHoursPerActivity: number;
  activitiesByType: Record<ActivityType, number>;
  hoursPerType: Record<ActivityType, number>;
  mostFrequentActivity: ActivityType;
  dateRange: {
    earliest: Date | string;
    latest: Date | string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ActivitiesResponse {
  activities: Activity[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
