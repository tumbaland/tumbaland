import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { Loader } from '../components/Loader';
import { ErrorPage, ErrorPageProps } from '../components/ErrorPage';
import { initMonitoring, initWebVitals } from '@tumbaland/frontend-core';
import { tumbalandTheme } from '../theme';

export interface CreateConfigProviderOptions<TConfig extends { PUBLIC_API_URL?: string }> {
  /** Passed to initMonitoring as the `service` tag. */
  serviceName: string;
  /** Pass `import.meta.env.DEV` from the calling app — reading `import.meta` here would not be reliably
   *  processed by Vite once compiled into this shared, pre-built package. */
  isDev: boolean;
  /** Pass `import.meta.env.MODE` from the calling app, for the same reason as `isDev`. */
  mode: string;
  /** Builds the config from `import.meta.env.VITE_*` — must be provided by the calling app so the
   *  `VITE_` env var reads stay in app source where Vite can statically resolve them. */
  getDevConfig: () => TConfig;
  /** Override the default ErrorPage props (e.g. shell-front's custom icon/title). */
  errorPageProps?: ErrorPageProps;
  /** Console levels to intercept in dev. Omit to use initMonitoring's own default (error + warn only). */
  devCaptureConsoleLevels?: ('debug' | 'info' | 'warn' | 'error')[];
}

/**
 * Builds a per-front ConfigProvider instance. Each of the 8 frontends previously hand-rolled their
 * own (8 divergent copies) — this factory keeps the dev/prod config loading, monitoring init, and
 * loading/error UI in one place. Each app still declares its own `AppConfig` shape and reads its own
 * `VITE_*` env vars via `getDevConfig`.
 */
export function createConfigProvider<TConfig extends { PUBLIC_API_URL?: string }>(
  options: CreateConfigProviderOptions<TConfig>
) {
  let globalConfig: TConfig | null = null;

  const ConfigContext = createContext<TConfig | null>(null);

  function getGlobalConfig(): TConfig {
    if (!globalConfig) {
      if (options.isDev) {
        const fallbackConfig = options.getDevConfig();
        console.warn('Using fallback configuration during HMR:', fallbackConfig);
        return fallbackConfig;
      }
      throw new Error('Configuration not initialized. Make sure ConfigProvider is mounted.');
    }
    return globalConfig;
  }

  function ConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<TConfig | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (options.isDev) {
        const devConfig = options.getDevConfig();
        console.log('Using development configuration from environment variables:', devConfig);
        setConfig(devConfig);
        globalConfig = devConfig;
        initMonitoring(options.mode, {
          service: options.serviceName,
          component: 'frontend',
          elkUrl: devConfig.PUBLIC_API_URL ? `${devConfig.PUBLIC_API_URL}/logs` : undefined,
          captureConsoleLevels: options.devCaptureConsoleLevels
        });
        initWebVitals({ isDevelopment: true }).catch(console.error);
        return;
      }

      fetch('/config.json')
        .then((res) => {
          if (!res.ok) throw new Error('Config fetch failed');
          return res.json();
        })
        .then((loadedConfig: TConfig) => {
          console.log('Using production configuration from config.json:', loadedConfig);
          setConfig(loadedConfig);
          globalConfig = loadedConfig;
          initMonitoring('production', {
            service: options.serviceName,
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
      return <ErrorPage {...options.errorPageProps} />;
    }

    if (!config) {
      return <Loader />;
    }

    const content = (
      <>
        <CssBaseline />
        {children}
      </>
    );

    return (
      <ConfigContext.Provider value={config}>
        <ThemeProvider theme={tumbalandTheme}>{content}</ThemeProvider>
      </ConfigContext.Provider>
    );
  }

  function useConfig(): TConfig {
    const config = useContext(ConfigContext);
    if (!config) {
      throw new Error('useConfig must be used within a ConfigProvider');
    }
    return config;
  }

  return { ConfigContext, ConfigProvider, getGlobalConfig, useConfig };
}
