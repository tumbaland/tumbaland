import { useEffect, useState, ReactNode } from 'react';
import { CssBaseline } from '@mui/material';
import { Loader } from '../components/Loader';
import { ErrorPage } from '../components/ErrorPage';
import React from 'react';

export interface AppConfig {
  ALBUM_URL?: string;
  FINANCE_URL?: string;
  RELATIONSHIP_URL?: string;
  PAYMENT_URL?: string;
  GROUP_URL?: string;
  PUBLIC_API_URL?: string;
}

// Global configuration holder for non-React services
let globalConfig: AppConfig | null = null;

export const ConfigContext = React.createContext<AppConfig>({});

// Helper function to create config from environment variables
function createDevConfig(): AppConfig {
  return {
    ALBUM_URL: import.meta.env.VITE_ALBUM_URL,
    FINANCE_URL: import.meta.env.VITE_FINANCE_URL,
    RELATIONSHIP_URL: import.meta.env.VITE_RELATIONSHIP_URL,
    PAYMENT_URL: import.meta.env.VITE_PAYMENT_URL,
    GROUP_URL: import.meta.env.VITE_GROUP_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL
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
      })
      .catch((err) => {
        console.error('Configuration load error:', err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return <ErrorPage />;
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
