import { relationshipApi } from '../config/relationshipApi';
import { ApiResponse, Day, DayEntryInput, DaysResponse, GetDaysFilters } from './types';

/**
 * Get days (newest first) with their entries, paginated by day.
 */
export const getDays = async (filters?: GetDaysFilters): Promise<DaysResponse> => {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.typeId) params.append('typeId', filters.typeId);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.groupId) params.append('groupId', filters.groupId);

  const response = await relationshipApi.get<ApiResponse<DaysResponse>>(
    `/days${params.size ? `?${params.toString()}` : ''}`
  );
  return response.data;
};

/**
 * Create or replace a day's entries in one call. Entries with _id are
 * updated, new ones created, missing ones deleted; [] clears the day.
 */
export const saveDay = async (
  date: string,
  entries: DayEntryInput[],
  groupId?: string
): Promise<Day> => {
  const response = await relationshipApi.put<ApiResponse<Day>>(`/days/${date}`, {
    entries,
    ...(groupId ? { groupId } : {})
  });
  return response.data;
};
