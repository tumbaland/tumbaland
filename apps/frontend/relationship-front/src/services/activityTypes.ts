import { relationshipApi as apiClient } from './relationshipApi';
import { ActivityType, PaginatedResponse, ApiResponse } from './types';

export interface CreateActivityTypeRequest {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
  valueType?: 'string' | 'boolean' | 'number';
  /** whether entries of this type can carry a place; orthogonal to valueType */
  hasLocation?: boolean;
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

// Reads currently on their way, by filter. The dashboard mounts several cards that
// each want the same list at the same moment; they share one request. Only
// requests still pending are shared, and any write forgets them, so nothing
// older than the last change is ever handed out.
const inFlight = new Map<string, Promise<ActivityTypesResponse>>();

/** Get all activity types. Concurrent calls with the same filters share one request. */
export const getActivityTypes = (filters?: GetActivityTypesFilters): Promise<ActivityTypesResponse> => {
  const key = JSON.stringify(filters ?? {});
  let pending = inFlight.get(key);
  if (!pending) {
    const request: Promise<ActivityTypesResponse> = fetchActivityTypes(filters).finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
    pending = request;
    inFlight.set(key, pending);
  }
  // A copy of the list per caller, so one that sorts or edits its own cannot change another's.
  return pending.then((response) => ({ ...response, data: [...response.data] }));
};

const fetchActivityTypes = async (filters?: GetActivityTypesFilters): Promise<ActivityTypesResponse> => {
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

/**
 * A write, with the shared reads forgotten on both sides of it: a read that set
 * off while the write was on its way may have been answered from before it.
 */
const write = async <T>(request: () => Promise<T>): Promise<T> => {
  inFlight.clear();
  try {
    return await request();
  } finally {
    inFlight.clear();
  }
};

// Create new activity type
export const createActivityType = (data: CreateActivityTypeRequest): Promise<ActivityType> =>
  write(async () => (await apiClient.post<ApiResponse<ActivityType>>('/activity-types', data)).data);

// Update activity type
export const updateActivityType = (id: string, data: UpdateActivityTypeRequest): Promise<ActivityType> =>
  write(async () => (await apiClient.put<ApiResponse<ActivityType>>(`/activity-types/${id}`, data)).data);

// Delete activity type
export const deleteActivityType = (id: string): Promise<void> =>
  write(async () => {
    await apiClient.delete(`/activity-types/${id}`);
  });

// Reorder activity types
export const reorderActivityTypes = (typeIds: string[], groupId?: string): Promise<void> =>
  write(async () => {
    await apiClient.post('/activity-types/reorder', { typeIds, groupId });
  });
