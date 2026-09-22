import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * The person's own settings, from auth-service's profile.
 *
 * No `onUnauthorized`: these are read behind the session gate, and a menu
 * preference is the last thing that should bounce anyone to the login screen.
 */
const client = createApiClient({ baseUrl: () => getGlobalConfig().AUTH_SERVICE_URL ?? '' });

/** The profile envelope, which predates the `{ data }` one the other services use. */
interface ProfileResponse {
  success: boolean;
  user?: { showMoney?: boolean };
}

export const profileApi = {
  /** Whether Money is in this person's menu. Off unless they turned it on under Features. */
  async getShowMoney(): Promise<boolean> {
    const json = await client.get<ProfileResponse>('/auth/profile');
    return json?.user?.showMoney === true;
  }
};
