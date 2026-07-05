import { createConfigProvider } from '@tumbaland/components';

export interface AppConfig {
  GOOGLE_CLIENT_ID?: string;
  AUTH_SERVICE_URL?: string;
  PUBLIC_API_URL?: string;
}

const factory = createConfigProvider<AppConfig>({
  serviceName: 'auth-front',
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  getDevConfig: () => ({
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL
  })
});

export const ConfigContext = factory.ConfigContext;
export const ConfigProvider = factory.ConfigProvider;
export const getGlobalConfig = factory.getGlobalConfig;
