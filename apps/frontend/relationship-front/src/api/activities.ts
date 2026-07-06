import { relationshipApi } from '../config/relationshipApi';
import { ActivityEntry, ApiResponse } from './types';

/**
 * Get all unique past descriptions for a given activity type (for Autocomplete)
 */
export const getActivityDescriptions = async (typeId: string, groupId?: string): Promise<string[]> => {
  const params = new URLSearchParams({ typeId });
  if (groupId) params.append('groupId', groupId);
  const response = await relationshipApi.get<ApiResponse<string[]>>(`/activities/descriptions?${params.toString()}`);
  return response.data;
};

// Keyed by activity type slug, then by "{months}months" timeline key (e.g. "1months", "3months", "12months").
export type RecentActivitiesSummary = Record<string, Record<string, { activities: ActivityEntry[] }>>;

/**
 * Get recent activities summary by category and timeline
 * @param groupId - Optional: group ID to filter by
 */
export const getRecentActivitiesSummary = async (groupId?: string): Promise<RecentActivitiesSummary> => {
  const response = await relationshipApi.get<ApiResponse<RecentActivitiesSummary>>('/activities/recent-summary', {
    params: groupId ? { groupId } : undefined
  });
  return response.data;
};
