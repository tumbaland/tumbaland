import { createAuthService } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

export const authService = createAuthService({
  getAuthServiceUrl: () => getGlobalConfig().AUTH_SERVICE_URL!,
  getAuthFrontUrl: () => getGlobalConfig().AUTH_FRONT_URL!
});
