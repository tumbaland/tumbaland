import { getGlobalConfig } from '../config/ConfigProvider';

export interface Group {
  _id: string;
  name: string;
  description?: string;
  memberCount?: number;
  isOwner?: boolean;
  createdAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

const getAuthToken = (): string => {
  return localStorage.getItem('authToken') || '';
};

const getHeaders = (): HeadersInit => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  };
};

export const getUserGroups = async (): Promise<Group[]> => {
  try {
    const config = getGlobalConfig();
    const response = await fetch(`${config.GROUP_API_URL}/api/groups/mine`, {
      headers: getHeaders()
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
};

export const getUserGroupIds = async (): Promise<string[]> => {
  try {
    const config = getGlobalConfig();
    const response = await fetch(`${config.GROUP_API_URL}/api/groups/mine/ids`, {
      headers: getHeaders()
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
};

// Legacy object export for backwards compatibility
export const groupService = {
  getUserGroups,
  getUserGroupIds
};
