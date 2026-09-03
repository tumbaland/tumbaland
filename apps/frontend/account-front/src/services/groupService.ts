import { createGroupService, Group } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

export type { Group };

export const { getUserGroups, getUserGroupIds } = createGroupService({
  getGroupApiUrl: () => getGlobalConfig().GROUP_API_URL!
});
