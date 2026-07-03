import { createGroupService, Group } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

export type { Group };

const service = createGroupService({
  getGroupApiUrl: () => getGlobalConfig().GROUP_API_URL!
});

export const { getUserGroups, getUserGroupIds } = service;

// Legacy object export for backwards compatibility
export const groupService = service;
