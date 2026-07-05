import { relationshipApi } from '../config/relationshipApi';
import { ApiResponse } from './types';

/**
 * Per-scope dashboard configuration (personal, or shared per group).
 * - highlightTypeIds: types featured as stat cards; the first also drives
 *   the monthly days-breakdown chart.
 * - hiddenTypeIds: types excluded from count-based charts.
 */
export interface DashboardSettingsData {
  highlightTypeIds: string[];
  hiddenTypeIds: string[];
}

export const getDashboardSettings = async (groupId?: string): Promise<DashboardSettingsData> => {
  const response = await relationshipApi.get<ApiResponse<DashboardSettingsData>>('/dashboard-settings', {
    params: groupId ? { groupId } : undefined
  });
  return response.data.data;
};

export const saveDashboardSettings = async (
  settings: DashboardSettingsData,
  groupId?: string
): Promise<DashboardSettingsData> => {
  const response = await relationshipApi.put<ApiResponse<DashboardSettingsData>>('/dashboard-settings', {
    ...settings,
    ...(groupId ? { groupId } : {})
  });
  return response.data.data;
};
