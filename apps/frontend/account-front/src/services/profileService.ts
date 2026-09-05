import { DeletionRequestResponse, UpdateProfileRequest, UpdateProfileResponse } from '../types';
import { accountApi } from './accountApi';

export const profileService = {
  // Update user profile
  async updateProfile(profileData: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    return accountApi.put<UpdateProfileResponse>('/auth/profile', profileData);
  },

  /**
   * Ask for the account to be removed.
   *
   * Records the request and nothing else — the account signs in and works
   * exactly as before, and an administrator removes the data by hand later.
   */
  async requestDeletion(): Promise<DeletionRequestResponse> {
    return accountApi.post<DeletionRequestResponse>('/auth/profile/deletion', {});
  },

  /** Take the request back. */
  async cancelDeletion(): Promise<DeletionRequestResponse> {
    return accountApi.delete<DeletionRequestResponse>('/auth/profile/deletion');
  }
};
