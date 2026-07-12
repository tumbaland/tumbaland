import { ForbiddenError } from '@tumbaland/backend-core';
import { DashboardSettings, IDashboardSettings } from '../models/DashboardSettings';

export interface DashboardSettingsData {
  highlightTypeIds: string[];
  hiddenTypeIds: string[];
}

const DEFAULT_SETTINGS: DashboardSettingsData = {
  highlightTypeIds: [],
  hiddenTypeIds: []
};

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
  return {
    highlightTypeIds: settings.highlightTypeIds,
    hiddenTypeIds: settings.hiddenTypeIds
  };
};

export const saveDashboardSettings = async (
  data: DashboardSettingsData,
  userId: string,
  userGroupIds: string[],
  groupId?: string
): Promise<DashboardSettingsData> => {
  assertGroupAccess(userGroupIds, groupId);
  const settings: IDashboardSettings = await DashboardSettings.findOneAndUpdate(
    scopeQuery(userId, groupId),
    {
      $set: {
        highlightTypeIds: data.highlightTypeIds,
        hiddenTypeIds: data.hiddenTypeIds
      },
      $setOnInsert: { userId, ...(groupId ? { groupId } : {}) }
    },
    { new: true, upsert: true }
  );
  return {
    highlightTypeIds: settings.highlightTypeIds,
    hiddenTypeIds: settings.hiddenTypeIds
  };
};
