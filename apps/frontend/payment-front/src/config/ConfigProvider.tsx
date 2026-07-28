import { createConfigProvider } from '@tumbaland/components';

export interface AppConfig {
  PAYMENT_API_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
  PUBLIC_API_URL?: string;
  SHELL_FRONT_URL?: string;
}

const factory = createConfigProvider<AppConfig>({
  serviceName: 'payment-front',
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  themed: true,
  getDevConfig: () => ({
    PAYMENT_API_URL: import.meta.env.VITE_PAYMENT_API_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL,
    SHELL_FRONT_URL: import.meta.env.VITE_SHELL_FRONT_URL
  })
});

export const ConfigContext = factory.ConfigContext;
export const ConfigProvider = factory.ConfigProvider;
export const getGlobalConfig = factory.getGlobalConfig;
export const useConfig = factory.useConfig;
