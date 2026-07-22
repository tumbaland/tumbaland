import { relationshipApi as apiClient } from './relationshipApi';
import { ActivityType, PaginatedResponse, ApiResponse } from './types';

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

interface ActivityTypesBackendData {
  types: ActivityType[];
  pagination: ActivityTypesResponse['pagination'];
}

// Get all activity types
export const getActivityTypes = async (filters?: GetActivityTypesFilters): Promise<ActivityTypesResponse> => {
  const params: Record<string, string | number | boolean> = {};

  if (filters?.isActive !== undefined) params.isActive = filters.isActive;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.page) params.page = filters.page;

  // Always include groupId parameter - send as empty string if undefined to distinguish from not provided
  if (filters?.groupId !== undefined) {
    params.groupId = filters.groupId;
  }

  const response = await apiClient.get<ApiResponse<ActivityTypesBackendData>>('/activity-types', { params });

  // Transform backend response to match frontend type
  const backendData = response.data;
  return {
    data: backendData.types,
    pagination: backendData.pagination
  };
};

// Get activity type by ID
export const getActivityTypeById = async (id: string): Promise<ActivityType> => {
  const response = await apiClient.get<ApiResponse<ActivityType>>(`/activity-types/${id}`);
  return response.data;
};

// Create new activity type
export const createActivityType = async (data: CreateActivityTypeRequest): Promise<ActivityType> => {
  const response = await apiClient.post<ApiResponse<ActivityType>>('/activity-types', data);
  return response.data;
};

// Update activity type
export const updateActivityType = async (id: string, data: UpdateActivityTypeRequest): Promise<ActivityType> => {
  const response = await apiClient.put<ApiResponse<ActivityType>>(`/activity-types/${id}`, data);
  return response.data;
};

// Delete activity type
export const deleteActivityType = async (id: string): Promise<void> => {
  await apiClient.delete(`/activity-types/${id}`);
};

// Reorder activity types
export const reorderActivityTypes = async (typeIds: string[], groupId?: string): Promise<void> => {
  await apiClient.post('/activity-types/reorder', { typeIds, groupId });
};
