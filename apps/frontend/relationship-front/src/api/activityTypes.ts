import { relationshipApi as apiClient } from '../config/relationshipApi';
import { ActivityType, PaginatedResponse } from './types';

export interface CreateActivityTypeRequest {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
  valueType?: 'string' | 'boolean' | 'number';
  groupId?: string;
}

export interface UpdateActivityTypeRequest extends Partial<CreateActivityTypeRequest> {
  isActive?: boolean;
  sortOrder?: number;
}

export interface GetActivityTypesFilters {
  isActive?: boolean;
  limit?: number;
  page?: number;
  groupId?: string;
}

export interface ActivityTypesResponse extends PaginatedResponse<ActivityType> {}

// Get all activity types
export const getActivityTypes = async (filters?: GetActivityTypesFilters): Promise<ActivityTypesResponse> => {
  const params: Record<string, any> = {};

  if (filters?.isActive !== undefined) params.isActive = filters.isActive;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.page) params.page = filters.page;

  // Always include groupId parameter - send as empty string if undefined to distinguish from not provided
  if (filters?.groupId !== undefined) {
    params.groupId = filters.groupId;
  }

  const response = await apiClient.get('/activity-types', { params });

  // Transform backend response to match frontend type
  const backendData = response.data;
  return {
    data: backendData.data.types,
    pagination: backendData.data.pagination
  };
};

// Get activity type by ID
export const getActivityTypeById = async (id: string): Promise<ActivityType> => {
  const response = await apiClient.get(`/activity-types/${id}`);
  return response.data.data;
};

// Create new activity type
export const createActivityType = async (data: CreateActivityTypeRequest): Promise<ActivityType> => {
  const response = await apiClient.post('/activity-types', data);
  return response.data.data;
};

// Update activity type
export const updateActivityType = async (id: string, data: UpdateActivityTypeRequest): Promise<ActivityType> => {
  const response = await apiClient.put(`/activity-types/${id}`, data);
  return response.data.data;
};

// Delete activity type
export const deleteActivityType = async (id: string): Promise<void> => {
  await apiClient.delete(`/activity-types/${id}`);
};

// Reorder activity types
export const reorderActivityTypes = async (typeIds: string[], groupId?: string): Promise<void> => {
  await apiClient.post('/activity-types/reorder', { typeIds, groupId });
};