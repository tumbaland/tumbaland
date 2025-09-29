import { useEffect, useState, ReactNode } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Loader, ErrorPage, initMonitoring, initWebVitals } from '@tumbaland/components';
import React from 'react';
import { authService } from '../services/authService';

export interface AppConfig {
  GROUP_API_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
  GROUP_FRONT_URL?: string;
  SHELL_FRONT_URL?: string;
  PUBLIC_API_URL?: string;
}

let globalConfig: AppConfig | null = null;
export const ConfigContext = React.createContext<AppConfig>({});

function createDevConfig(): AppConfig {
  return {
    GROUP_API_URL: import.meta.env.VITE_GROUP_API_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
    GROUP_FRONT_URL: import.meta.env.VITE_GROUP_FRONT_URL,
    SHELL_FRONT_URL: import.meta.env.VITE_SHELL_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL
  };
}

export function getGlobalConfig(): AppConfig {
  if (!globalConfig) {
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      const fallback = createDevConfig();
      console.warn('Using fallback configuration during HMR:', fallback);
      return fallback;
    }
    throw new Error('Configuration not initialized.');
  }
  return globalConfig;
}

interface ConfigProviderProps { children: ReactNode; }

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      const devConfig = createDevConfig();
      setConfig(devConfig);
      globalConfig = devConfig;
      // Initialize local monitoring
      initMonitoring(import.meta.env.MODE, {
        service: 'group-front',
        component: 'frontend',
        elkUrl: devConfig.PUBLIC_API_URL ? `${devConfig.PUBLIC_API_URL}/logs` : undefined
      });
      initWebVitals({ isDevelopment: true }).catch(console.error);
      authService.init();
      return;
    }

    fetch('/config.json')
      .then((res) => { if (!res.ok) throw new Error('Config fetch failed'); return res.json(); })
      .then((loaded) => { 
        setConfig(loaded); 
        globalConfig = loaded; 
        // Initialize local monitoring
        initMonitoring('production', {
          service: 'group-front',
          component: 'frontend',
          elkUrl: loaded.PUBLIC_API_URL ? `${loaded.PUBLIC_API_URL}/logs` : undefined
        });
        initWebVitals({ isDevelopment: false }).catch(console.error);
        authService.init(); 
      })
      .catch((err) => { console.error('Configuration load error:', err); setError(err.message); });
  }, []);

  if (error) {
    return <ErrorPage />;
  }
  if (!config) {
    return <Loader />;
  }
  return (
    <ConfigContext.Provider value={config}>
      <ThemeProvider theme={createTheme({
        palette: {
          background: {
            default: '#f7f7fa'
          }
        }
      })}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ConfigContext.Provider>
  );
}
