import { createAppAuthService } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

export const authService = createAppAuthService(getGlobalConfig);
