import { getCorrelationId, getSessionId } from './monitoring';
import { ApiResponse, Group } from './types';

export interface GroupServiceConfig {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  getGroupApiUrl: () => string;
}

function groupHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-correlation-id': getCorrelationId(),
    'x-session-id': getSessionId()
  };
}

/**
 * Builds a per-front group service instance, consolidating the
 * getUserGroups/getUserGroupIds pair that was duplicated across
 * album/finance/relationship-front (TECHNICAL_REVIEW.md P1.3).
 *
 *   export const { getUserGroups, getUserGroupIds } = createGroupService({
 *     getGroupApiUrl: () => getGlobalConfig().GROUP_API_URL!
 *   });
 */
export function createGroupService(config: GroupServiceConfig) {
  return {
    async getUserGroups(): Promise<Group[]> {
      try {
        const response = await fetch(`${config.getGroupApiUrl()}/api/groups/mine`, {
          credentials: 'include',
          headers: groupHeaders()
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch groups: ${response.statusText}`);
        }

        const result: ApiResponse<Group[]> = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch groups');
        }

        return result.data;
      } catch (error) {
        console.error('Error fetching user groups:', error);
        throw error;
      }
    },

    async getUserGroupIds(): Promise<string[]> {
      try {
        const response = await fetch(`${config.getGroupApiUrl()}/api/groups/mine/ids`, {
          credentials: 'include',
          headers: groupHeaders()
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch group IDs: ${response.statusText}`);
        }

        const result: ApiResponse<string[]> = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch group IDs');
        }

        return result.data;
      } catch (error) {
        console.error('Error fetching user group IDs:', error);
        throw error;
      }
    }
  };
}

export type GroupService = ReturnType<typeof createGroupService>;
