import { createConfigProvider } from '@tumbaland/frontend-core';

export interface AppConfig {
  RELATIONSHIP_API_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
  GROUP_API_URL?: string;
  ACCOUNT_FRONT_URL?: string;
  SHELL_FRONT_URL?: string;
  PUBLIC_API_URL?: string;
}

const factory = createConfigProvider<AppConfig>({
  serviceName: 'relationship-front',
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  // This app's own config.json, even when shell-front's page is the one
  // running it: as a federated remote, a bare '/config.json' would resolve
  // against the shell's origin and carry none of this app's service URLs.
  configUrl: new URL(/* @vite-ignore */ '/config.json', import.meta.url).href,
  getDevConfig: () => ({
    RELATIONSHIP_API_URL: import.meta.env.VITE_RELATIONSHIP_API_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
    GROUP_API_URL: import.meta.env.VITE_GROUP_API_URL,
    ACCOUNT_FRONT_URL: import.meta.env.VITE_ACCOUNT_FRONT_URL,
    SHELL_FRONT_URL: import.meta.env.VITE_SHELL_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL
  })
});

export const ConfigContext = factory.ConfigContext;
export const ConfigProvider = factory.ConfigProvider;
export const getGlobalConfig = factory.getGlobalConfig;
export const useConfig = factory.useConfig;
