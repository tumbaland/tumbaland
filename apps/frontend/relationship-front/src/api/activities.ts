import { relationshipApi } from '../config/relationshipApi';
import {
  Activity,
  CreateActivityRequest,
  UpdateActivityRequest,
  GetActivitiesFilters,
  ActivityStats,
  ActivityType,
  ActivitiesResponse
} from './types';

// Activity API functions

/**
 * Create a new activity
 */
export const createActivity = async (activityData: CreateActivityRequest): Promise<Activity> => {
  const response = await relationshipApi.post('/activities', activityData);
  return response.data.data;
};

/**
 * Get all activities with optional filters
 */
export const getActivities = async (filters?: GetActivitiesFilters): Promise<ActivitiesResponse> => {
  const params = new URLSearchParams();

  if (filters?.activityType) params.append('activityType', filters.activityType);
  if (filters?.startDate) params.append('startDate', new Date(filters.startDate).toISOString());
  if (filters?.endDate) params.append('endDate', new Date(filters.endDate).toISOString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
  if (filters?.groupId) params.append('groupId', filters.groupId);

  const response = await relationshipApi.get(`/activities${params.toString() ? `?${params.toString()}` : ''}`);
  return response.data.data;
};

/**
 * Get activity by ID
 */
export const getActivityById = async (id: string): Promise<Activity> => {
  const response = await relationshipApi.get(`/activities/${id}`);
  return response.data.data;
};

/**
 * Update activity by ID
 */
export const updateActivity = async (id: string, updateData: UpdateActivityRequest): Promise<Activity> => {
  const response = await relationshipApi.put(`/activities/${id}`, updateData);
  return response.data.data;
};

/**
 * Delete activity by ID
 */
export const deleteActivity = async (id: string): Promise<void> => {
  await relationshipApi.delete(`/activities/${id}`);
};

/**
 * Get activity statistics
 */
export const getActivityStats = async (filters?: {
  startDate?: Date | string;
  endDate?: Date | string;
}): Promise<ActivityStats> => {
  const params = new URLSearchParams();

  if (filters?.startDate) params.append('startDate', new Date(filters.startDate).toISOString());
  if (filters?.endDate) params.append('endDate', new Date(filters.endDate).toISOString());

  const response = await relationshipApi.get(`/activities/stats${params.toString() ? `?${params.toString()}` : ''}`);
  return response.data.data;
};

/**
 * Get activities by date range
 */
export const getActivitiesByDateRange = async (
  startDate: Date | string,
  endDate: Date | string
): Promise<Activity[]> => {
  const params = new URLSearchParams();
  params.append('startDate', new Date(startDate).toISOString());
  params.append('endDate', new Date(endDate).toISOString());

  const response = await relationshipApi.get(`/activities/date-range?${params.toString()}`);
  return response.data.data;
};

/**
 * Get recent activities
 */
export const getRecentActivities = async (limit: number = 10): Promise<Activity[]> => {
  const response = await relationshipApi.get(`/activities/recent?limit=${limit}`);
  return response.data.data;
};

/**
 * Get available activity types
 */
export const getActivityTypes = async (): Promise<ActivityType[]> => {
  const response = await relationshipApi.get('/activities/types');
  return response.data.data;
};

/**
 * Get recent activities summary by category and timeline
 * @param groupId - Optional: group ID to filter by
 */
export const getRecentActivitiesSummary = async (groupId?: string): Promise<any> => {
  const params: Record<string, any> = {};
  if (groupId) {
    params.groupId = groupId;
  }
  
  const response = await relationshipApi.get('/activities/recent-summary', {
    params: Object.keys(params).length > 0 ? params : undefined
  });
  return response.data.data;
};
