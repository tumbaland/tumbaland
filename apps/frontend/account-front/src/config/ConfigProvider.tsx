import { useEffect, useState, ReactNode } from 'react';
import { CssBaseline } from '@mui/material';
import { Loader, ErrorPage, initMonitoring, initWebVitals } from '@tumbaland/components';
import { authService } from '../services/authService';
import React from 'react';

export interface AppConfig {
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
  PUBLIC_API_URL?: string;
}

// Global configuration holder for non-React services
let globalConfig: AppConfig | null = null;

export const ConfigContext = React.createContext<AppConfig>({});

// Helper function to create config from environment variables
function createDevConfig(): AppConfig {
  return {
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
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
            // Initialize local monitoring
      initMonitoring(import.meta.env.MODE, {
        service: 'account-front',
        component: 'frontend',
        elkUrl: devConfig.PUBLIC_API_URL ? `${devConfig.PUBLIC_API_URL}/logs` : undefined,
        captureConsoleLevels: ['error', 'warn', 'info', 'debug'] // Capture all levels in development
      });
      
      initWebVitals({ isDevelopment: true }).catch(console.error);
      authService.init();
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
          service: 'account-front',
          component: 'frontend',
          elkUrl: loadedConfig.PUBLIC_API_URL ? `${loadedConfig.PUBLIC_API_URL}/logs` : undefined,
          captureConsoleLevels: ['error', 'warn'] // Only capture errors and warnings in production
        });
        
        initWebVitals({ isDevelopment: false }).catch(console.error);
        // Initialize auth service
        authService.init();
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
