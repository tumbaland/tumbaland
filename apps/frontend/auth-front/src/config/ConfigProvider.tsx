import { useEffect, useState, ReactNode } from "react";
import { CssBaseline } from "@mui/material";
import { ConfigContext } from "../App";
import { Loader } from "../components/Loader.tsx";
import { ErrorPage } from "../components/ErrorPage.tsx";

export interface AppConfig {
  GOOGLE_CLIENT_ID?: string;
  AUTH_SERVICE_URL?: string;
}

// Global configuration holder for non-React services
let globalConfig: AppConfig | null = null;

export function getGlobalConfig(): AppConfig {
  if (!globalConfig) {
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
    fetch("/config.json")
      .then((res) => {
        if (!res.ok) throw new Error("Config fetch failed");
        return res.json();
      })
      .then((loadedConfig) => {
        setConfig(loadedConfig);
        // Set global config for non-React services
        globalConfig = loadedConfig;
      })
      .catch((err) => {
        // Fallback for local dev: use Vite env vars if available
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          const devConfig: AppConfig = {
            GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
          };
          console.log('Using development configuration:', devConfig);
          setConfig(devConfig);
          globalConfig = devConfig;
        } else {
          console.error('Configuration load error:', err);
          setError(err.message);
        }
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
