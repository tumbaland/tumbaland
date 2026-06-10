// Activity Types based on backend model
export interface Activity {
  _id?: string;
  id?: string;
  date: Date | string;
  hours: number;
  activity: {
    typeId: ActivityType;
    description: string;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ActivityType {
  _id: string;
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  valueType?: 'string' | 'boolean' | 'number';
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  userId: string;
  groupId?: string;
}

export interface CreateActivityRequest {
  date: Date | string;
  hours?: number;
  activity: {
    typeId: string; // ActivityType ID
    description?: string;
  };
  groupId?: string;
}

export interface UpdateActivityRequest extends Partial<CreateActivityRequest> {}

export interface GetActivitiesFilters {
  activityType?: string; // ActivityType slug
  startDate?: Date | string;
  endDate?: Date | string;
  description?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  groupId?: string;
}

export interface ActivityStats {
  totalActivities: number;
  totalHours: number;
  averageHoursPerActivity: number;
  activitiesByType: Record<string, number>;
  hoursPerType: Record<string, number>;
  mostFrequentActivity: string;
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
