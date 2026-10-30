import { createConfigProvider } from '@tumbaland/frontend-core';

export interface AppConfig {
  /** admin-service: what the screens read. */
  ADMIN_API_URL?: string;
  /** chat-service: the Anthropic key the chat assistants run on, and what they cost. */
  CHAT_API_URL?: string;
  /** payment-service: where an administrator changes one person's assistant allowance. */
  PAYMENT_API_URL?: string;
  /** auth-service: where an administrator closes an account that asked to be deleted. */
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
  SHELL_FRONT_URL?: string;
  /** public-service, where this app's browser logs are sent. */
  PUBLIC_API_URL?: string;
}

const factory = createConfigProvider<AppConfig>({
  serviceName: 'admin-front',
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  // This app's own config.json, even when shell-front's page is the one
  // running it: as a federated remote, a bare '/config.json' would resolve
  // against the shell's origin and carry none of this app's service URLs.
  configUrl: new URL(/* @vite-ignore */ '/config.json', import.meta.url).href,
  devCaptureConsoleLevels: ['error', 'warn', 'info', 'debug'],
  getDevConfig: () => ({
    ADMIN_API_URL: import.meta.env.VITE_ADMIN_API_URL,
    CHAT_API_URL: import.meta.env.VITE_CHAT_API_URL,
    PAYMENT_API_URL: import.meta.env.VITE_PAYMENT_API_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
    SHELL_FRONT_URL: import.meta.env.VITE_SHELL_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL
  })
});

export const ConfigContext = factory.ConfigContext;
export const ConfigProvider = factory.ConfigProvider;
export const getGlobalConfig = factory.getGlobalConfig;
export const useConfig = factory.useConfig;
