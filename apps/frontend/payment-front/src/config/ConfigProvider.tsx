import { useEffect, useState, ReactNode } from 'react';
import { CssBaseline } from '@mui/material';
import React from 'react';
import { authService } from '../services/authService';

export interface AppConfig {
  PAYMENT_API_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
}

let globalConfig: AppConfig | null = null;
export const ConfigContext = React.createContext<AppConfig>({});

function createDevConfig(): AppConfig {
  return {
    PAYMENT_API_URL: import.meta.env.VITE_PAYMENT_API_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL
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
      authService.init();
      return;
    }

    fetch('/config.json')
      .then((res) => { if (!res.ok) throw new Error('Config fetch failed'); return res.json(); })
      .then((loaded) => { setConfig(loaded); globalConfig = loaded; authService.init(); })
      .catch((err) => { console.error('Configuration load error:', err); setError(err.message); });
  }, []);

  if (error) {
    return <div>Configuration error</div>;
  }
  if (!config) {
    return <div>Loading...</div>;
  }
  return (
    <ConfigContext.Provider value={config}>
      <CssBaseline />
      {children}
    </ConfigContext.Provider>
  );
}
