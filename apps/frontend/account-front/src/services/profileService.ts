import { UpdateProfileRequest, UpdateProfileResponse } from '../types';
import { getGlobalConfig } from '../config/ConfigProvider';
import { getCorrelationId, getSessionId } from '@tumbaland/components';

export const profileService = {
  // Update user profile
  async updateProfile(profileData: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    try {
      const config = getGlobalConfig();
      const response = await fetch(`${config.AUTH_SERVICE_URL}/auth/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': getCorrelationId(),
          'x-session-id': getSessionId()
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }
};
