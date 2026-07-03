import { useEffect, useState, ReactNode } from 'react';
import { CssBaseline } from '@mui/material';
import { Loader, ErrorPage, initMonitoring, initWebVitals } from '@tumbaland/components';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';
import React from 'react';

export interface AppConfig {
  ALBUM_FRONT_URL?: string;
  FINANCE_FRONT_URL?: string;
  RELATIONSHIP_FRONT_URL?: string;
  PAYMENT_FRONT_URL?: string;
  GROUP_FRONT_URL?: string;
  PUBLIC_API_URL?: string;
  ACCOUNT_FRONT_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
}

// Global configuration holder for non-React services
let globalConfig: AppConfig | null = null;

export const ConfigContext = React.createContext<AppConfig>({});

// Helper function to create config from environment variables
function createDevConfig(): AppConfig {
  return {
    ALBUM_FRONT_URL: import.meta.env.VITE_ALBUM_FRONT_URL,
    FINANCE_FRONT_URL: import.meta.env.VITE_FINANCE_FRONT_URL,
    RELATIONSHIP_FRONT_URL: import.meta.env.VITE_RELATIONSHIP_FRONT_URL,
    PAYMENT_FRONT_URL: import.meta.env.VITE_PAYMENT_FRONT_URL,
    GROUP_FRONT_URL: import.meta.env.VITE_GROUP_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL,
    ACCOUNT_FRONT_URL: import.meta.env.VITE_ACCOUNT_FRONT_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL
  };
}

export function getGlobalConfig(): AppConfig {
  if (!globalConfig) {
    // During HMR in development, config might be temporarily unavailable
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      // Return a safe fallback config during HMR using environment variables
      const fallbackConfig = createDevConfig();
      console.warn('Using fallback configuration during HMR:', fallbackConfig);
      return fallbackConfig;
    }
    throw new Error('Configuration not initialized. Make sure ConfigProvider is mounted.');
  }
  return globalConfig;
}

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In development, use environment variables directly
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      const devConfig = createDevConfig();
      console.log('Using development configuration from environment variables:', devConfig);
      setConfig(devConfig);
      globalConfig = devConfig;
      // Initialize local monitoring
      initMonitoring(import.meta.env.MODE, {
        service: 'shell-front',
        component: 'frontend',
        elkUrl: devConfig.PUBLIC_API_URL ? `${devConfig.PUBLIC_API_URL}/logs` : undefined
      });
      initWebVitals({ isDevelopment: true }).catch(console.error);
      return;
    }

    // In production, fetch config.json
    fetch('/config.json')
      .then((res) => {
        if (!res.ok) throw new Error('Config fetch failed');
        return res.json();
      })
      .then((loadedConfig) => {
        console.log('Using production configuration from config.json:', loadedConfig);
        setConfig(loadedConfig);
        // Set global config for non-React services
        globalConfig = loadedConfig;
        // Initialize local monitoring
        initMonitoring('production', {
          service: 'shell-front',
          component: 'frontend',
          elkUrl: loadedConfig.PUBLIC_API_URL ? `${loadedConfig.PUBLIC_API_URL}/logs` : undefined
        });
        initWebVitals({ isDevelopment: false }).catch(console.error);
      })
      .catch((err) => {
        console.error('Configuration load error:', err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <ErrorPage
        title="Something went wrong"
        message=""
        icon={<HeartBrokenIcon sx={{ fontSize: 80, color: '#ef4444', mb: 2 }} />}
        showRetry={false}
      />
    );
  }

  if (!config) {
    return <Loader />;
  }

  return (
    <ConfigContext.Provider value={config}>
      <CssBaseline />
      {children}
    </ConfigContext.Provider>
  );
}
