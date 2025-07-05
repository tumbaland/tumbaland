/**
 * Runtime Configuration
 * Loads configuration from window object or fallback to build-time env vars
 */

export interface AppConfig {
  ALBUM_API_URL: string;
  AUTH_SERVICE_URL: string;
  AUTH_FRONT_URL: string;
}

// Default configuration with fallbacks
const defaultConfig: AppConfig = {
  ALBUM_API_URL: import.meta.env.VITE_ALBUM_API_URL,
  AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
  AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
};

// Runtime config that can be overridden by window.APP_CONFIG
let runtimeConfig: AppConfig = { ...defaultConfig };

// Check if runtime config is available on window object
declare global {
  interface Window {
    APP_CONFIG?: Partial<AppConfig>;
  }
}

export function initializeConfig(): void {
  if (window.APP_CONFIG) {
    runtimeConfig = {
      ...defaultConfig,
      ...window.APP_CONFIG,
    };
    console.log('Using runtime configuration:', runtimeConfig);
  } else {
    console.log('Using default configuration:', runtimeConfig);
  }
}

export function getConfig(): AppConfig {
  return runtimeConfig;
}

// Load configuration from /config.js if available
export async function loadRuntimeConfig(): Promise<void> {
  try {
    // Try to load config.js
    await new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = '/config.js';
      script.onload = () => {
        initializeConfig();
        resolve();
      };
      script.onerror = () => {
        console.log('No runtime config found, using defaults');
        initializeConfig();
        resolve();
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    console.log('Failed to load runtime config, using defaults:', error);
    initializeConfig();
  }
}
