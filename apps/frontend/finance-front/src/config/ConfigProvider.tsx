import { createContext, useEffect, useState, ReactNode } from "react";
import { CssBaseline } from "@mui/material";
import { ErrorPage } from "../components/ErrorPage";
import { authService } from "../services/authService";
import { Loader } from "../components/Loader";

export interface AppConfig {
  FINANCE_API_URL?: string;
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
}

// Create the context in the same file as the provider
export const ConfigContext = createContext<AppConfig>({});

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
        // Initialize auth service
        authService.init();
      })
      .catch((err) => {
        // Fallback for local dev: use Vite env vars if available
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          const devConfig: AppConfig = {
            FINANCE_API_URL: import.meta.env.VITE_FINANCE_API_URL,
            AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
            AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
          };
          console.log('Using development configuration:', devConfig);
          setConfig(devConfig);
          globalConfig = devConfig;
          authService.init();
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
