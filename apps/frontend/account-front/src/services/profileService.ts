import { DeletionRequestResponse, UpdateProfileRequest, UpdateProfileResponse } from '../types';
import { accountApi } from './accountApi';
import { getGlobalConfig } from '../config/ConfigProvider';

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
  },

  /**
   * Sets the profile picture.
   *
   * Sent as the image bytes rather than JSON, so this goes around the JSON
   * client. The server re-signs the session cookie in the same response, so
   * the new picture is what every app sees from the next request on.
   */
  async uploadPicture(image: Blob): Promise<string> {
    const response = await fetch(`${getGlobalConfig().AUTH_SERVICE_URL}/auth/profile/picture`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': image.type || 'image/jpeg' },
      body: image
    });
    const result = (await response.json().catch(() => ({}))) as { picture?: string; message?: string };
    if (!response.ok || !result.picture) {
      throw new Error(result.message || 'Could not save the picture. Please try again.');
    }
    return result.picture;
  },

  /** Removes an uploaded picture. Returns Google's picture, if there is one. */
  async removePicture(): Promise<string | undefined> {
    const result = await accountApi.delete<{ picture: string | null }>('/auth/profile/picture');
    return result?.picture ?? undefined;
  }
};
