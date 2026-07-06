import { UpdateProfileRequest, UpdateProfileResponse } from '../types';
import { accountApi } from './accountApi';

export const profileService = {
  // Update user profile
  async updateProfile(profileData: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    return accountApi.put<UpdateProfileResponse>('/auth/profile', profileData);
  }
};
