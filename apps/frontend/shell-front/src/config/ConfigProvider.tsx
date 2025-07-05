import { useEffect, useState, ReactNode } from "react";
import { CssBaseline } from "@mui/material";
import { ConfigContext } from "../App";
import { Loader } from "../components/Loader";
import { ErrorPage } from "../components/ErrorPage";

export interface AppConfig {
  VITE_RELATIONSHIP_URL?: string;
  VITE_ALBUM_URL?: string;
  VITE_FINANCE_URL?: string;
  VITE_PUBLIC_API_URL?: string;
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
      .then(setConfig)
      .catch((err) => {
        // Fallback for local dev: use Vite env vars if available
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          const devConfig: AppConfig = {
            VITE_RELATIONSHIP_URL: import.meta.env.VITE_RELATIONSHIP_URL,
            VITE_ALBUM_URL: import.meta.env.VITE_ALBUM_URL,
            VITE_FINANCE_URL: import.meta.env.VITE_FINANCE_URL,
            VITE_PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL,
          };
          setConfig(devConfig);
        } else {
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
