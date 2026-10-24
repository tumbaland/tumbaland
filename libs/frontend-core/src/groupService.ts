import { createApiClient } from './apiClient';
import { logger } from './monitoring';
import { ApiResponse, Group } from './types';

export interface GroupServiceConfig {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  getGroupApiUrl: () => string;
}

/**
 * Builds a per-front group service instance, consolidating the
 * getUserGroups/getUserGroupIds pair that was duplicated across
 * album/finance/relationship-front.
 *
 *   export const { getUserGroups, getUserGroupIds } = createGroupService({
 *     getGroupApiUrl: () => getGlobalConfig().GROUP_API_URL!
 *   });
 *
 * The members are arrow functions so they can be destructured as above.
 */
export function createGroupService(config: GroupServiceConfig) {
  const client = createApiClient({ baseUrl: () => config.getGroupApiUrl() });

  const read = async <T>(path: string, failure: string, logged: string): Promise<T> => {
    try {
      const result = await client.get<ApiResponse<T>>(path);
      if (!result.success) {
        throw new Error(result.message || failure);
      }
      return result.data;
    } catch (error) {
      logger.error(logged, error);
      throw error;
    }
  };

  return {
    getUserGroups: (): Promise<Group[]> => read<Group[]>('/api/groups/mine', 'Failed to fetch groups', 'Error fetching user groups'),
    getUserGroupIds: (): Promise<string[]> => read<string[]>('/api/groups/mine/ids', 'Failed to fetch group IDs', 'Error fetching user group IDs')
  };
}

export type GroupService = ReturnType<typeof createGroupService>;
