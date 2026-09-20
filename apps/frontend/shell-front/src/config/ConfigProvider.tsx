import { createConfigProvider } from '@tumbaland/frontend-core';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';

export interface AppConfig {
  ALBUM_FRONT_URL?: string;
  FINANCE_FRONT_URL?: string;
  RELATIONSHIP_FRONT_URL?: string;
  PAYMENT_FRONT_URL?: string;
  GROUP_FRONT_URL?: string;
  PUBLIC_API_URL?: string;
  /** payment-service, for the plan and usage meters on the signed-in home page. */
  PAYMENT_API_URL?: string;
  ACCOUNT_FRONT_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
}

const factory = createConfigProvider<AppConfig>({
  serviceName: 'shell-front',
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  getDevConfig: () => ({
    ALBUM_FRONT_URL: import.meta.env.VITE_ALBUM_FRONT_URL,
    FINANCE_FRONT_URL: import.meta.env.VITE_FINANCE_FRONT_URL,
    RELATIONSHIP_FRONT_URL: import.meta.env.VITE_RELATIONSHIP_FRONT_URL,
    PAYMENT_FRONT_URL: import.meta.env.VITE_PAYMENT_FRONT_URL,
    GROUP_FRONT_URL: import.meta.env.VITE_GROUP_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL,
    PAYMENT_API_URL: import.meta.env.VITE_PAYMENT_API_URL,
    ACCOUNT_FRONT_URL: import.meta.env.VITE_ACCOUNT_FRONT_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL
  }),
  errorPageProps: {
    title: 'Something went wrong',
    message: '',
    icon: <HeartBrokenIcon sx={{ fontSize: 80, color: '#ef4444', mb: 2 }} />,
    showRetry: false
  }
});

export const ConfigContext = factory.ConfigContext;
export const ConfigProvider = factory.ConfigProvider;
export const getGlobalConfig = factory.getGlobalConfig;
export const useConfig = factory.useConfig;
