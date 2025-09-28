// Configuration and initialization for monitoring
export interface MonitoringConfig {
  isDevelopment: boolean;
  service: string;
  component: string;
  elkUrl?: string;
  captureConsoleLevels?: ('debug' | 'info' | 'warn' | 'error')[];
}

// Global monitoring configuration
let monitoringConfig: MonitoringConfig = {
  isDevelopment: false,
  service: 'frontend',
  component: 'frontend'
};

// Flag to prevent recursive console interception
export let isInterceptingConsole = false;

// Get current monitoring configuration
export const getMonitoringConfig = (): MonitoringConfig => monitoringConfig;

// Update monitoring configuration
export const updateMonitoringConfig = (config: Partial<MonitoringConfig>) => {
  monitoringConfig = { ...monitoringConfig, ...config };
};

// Initialize local monitoring (no remote services)
export const initMonitoring = (environment: string = 'development', options: {
  service?: string;
  component?: string;
  elkUrl?: string;
  captureConsoleLevels?: ('debug' | 'info' | 'warn' | 'error')[];
} = {}) => {
  const {
    service = 'frontend',
    component = 'frontend',
    elkUrl,
    captureConsoleLevels = ['error', 'warn'] // Default to error and warn only
  } = options;

  // Update global config
  updateMonitoringConfig({
    isDevelopment: environment === 'development',
    service,
    component,
    elkUrl
  });

  console.log(`📊 Local monitoring initialized (${environment} mode) for ${service}/${component}`);
  console.log(`📝 Console interception enabled for levels: ${captureConsoleLevels.join(', ')}`);

  // Initialize console interception and error handlers after modules are loaded
  Promise.all([
    import('./console'),
    import('./errors')
  ]).then(([{ initConsoleInterception }, { captureException, captureMessage }]) => {
    // Initialize console interception with capture function
    initConsoleInterception(captureConsoleLevels, captureMessage);

    // Set up global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        captureException(event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        captureException(new Error(`Unhandled promise rejection: ${event.reason}`), {
          type: 'unhandledrejection'
        });
      });
    }
  });
};