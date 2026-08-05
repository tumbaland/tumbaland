import { ForbiddenError } from '@tumbaland/backend-core';
import { DashboardSettings, IDashboardSettings } from '../models/DashboardSettings';

export interface DashboardSettingsData {
  highlightTypeIds: string[];
  hiddenTypeIds: string[];
  /** YYYY-MM-DD the "days together" count runs from; null/absent = first entry */
  startDate?: string | null;
}

const DEFAULT_SETTINGS: DashboardSettingsData = {
  highlightTypeIds: [],
  hiddenTypeIds: [],
  startDate: null
};

const toData = (settings: IDashboardSettings): DashboardSettingsData => ({
  highlightTypeIds: settings.highlightTypeIds,
  hiddenTypeIds: settings.hiddenTypeIds,
  startDate: settings.startDate ?? null
});

/** Personal settings are keyed by user; group settings are shared per group. */
const scopeQuery = (userId: string, groupId?: string) =>
  groupId ? { groupId } : { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };

const assertGroupAccess = (userGroupIds: string[], groupId?: string) => {
  if (groupId && !userGroupIds.includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }
};

export const getDashboardSettings = async (
  userId: string,
  userGroupIds: string[],
  groupId?: string
): Promise<DashboardSettingsData> => {
  assertGroupAccess(userGroupIds, groupId);
  const settings = await DashboardSettings.findOne(scopeQuery(userId, groupId));
  if (!settings) return { ...DEFAULT_SETTINGS };
  return toData(settings);
};

export const saveDashboardSettings = async (
  data: DashboardSettingsData,
  userId: string,
  userGroupIds: string[],
  groupId?: string
): Promise<DashboardSettingsData> => {
  assertGroupAccess(userGroupIds, groupId);
  // An empty start date clears the override rather than storing a blank string,
  // so the count falls back to the first entry again.
  const settings: IDashboardSettings = await DashboardSettings.findOneAndUpdate(
    scopeQuery(userId, groupId),
    {
      $set: {
        highlightTypeIds: data.highlightTypeIds,
        hiddenTypeIds: data.hiddenTypeIds,
        ...(data.startDate ? { startDate: data.startDate } : {})
      },
      ...(data.startDate ? {} : { $unset: { startDate: '' } }),
      $setOnInsert: { userId, ...(groupId ? { groupId } : {}) }
    },
    { new: true, upsert: true }
  );
  return toData(settings);
};
