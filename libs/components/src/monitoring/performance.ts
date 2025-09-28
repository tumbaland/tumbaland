// Performance monitoring utilities

import { getMonitoringConfig, isInterceptingConsole } from './config';

// Web vitals will be loaded dynamically
let webVitals: any = null;

// User tracking (local storage only)
export const setUser = (
  user: { id: string; email?: string; username?: string },
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...getMonitoringConfig(), ...options };

  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole();
    (window as any)._monitoringInterceptingConsole = true;
    try {
      console.log('👤 User set:', user);
    } finally {
      (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
    }
  }
  // Could store in localStorage for persistence if needed
};

export const setTag = (
  key: string,
  value: string,
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...getMonitoringConfig(), ...options };

  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole();
    (window as any)._monitoringInterceptingConsole = true;
    try {
      console.log(`🏷️ Tag set: ${key} = ${value}`);
    } finally {
      (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
    }
  }
  // Store tags locally if needed for context
};

// Performance monitoring utilities (local only)
export const startTransaction = (
  name: string,
  op: string,
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...getMonitoringConfig(), ...options };

  const startTime = Date.now();
  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole();
    (window as any)._monitoringInterceptingConsole = true;
    try {
      console.log(`⏱️ Transaction started: ${name} (${op})`);
    } finally {
      (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
    }
  }

  return {
    finish: () => {
      const duration = Date.now() - startTime;
      recordMetric(`${name}_duration`, duration, 'ms', { isDevelopment: config.isDevelopment });
      if (config.isDevelopment) {
        const originalIsIntercepting = isInterceptingConsole();
        (window as any)._monitoringInterceptingConsole = true;
        try {
          console.log(`✅ Transaction finished: ${name} (${duration}ms)`);
        } finally {
          (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
        }
      }
    }
  };
};

export const recordMetric = (
  name: string,
  value: number | { value: number; id?: string },
  unit: string = 'ms',
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...getMonitoringConfig(), ...options };

  // Handle both number and metric object formats
  const metricValue = typeof value === 'number' ? value : value.value;

  // Always log to console for development with better formatting
  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole();
    (window as any)._monitoringInterceptingConsole = true;
    try {
      const formattedValue = unit === 'ms' ? `${metricValue.toFixed(2)}ms` : `${metricValue}${unit}`;
      console.log(`📊 Performance: ${name} = ${formattedValue}`);
    } finally {
      (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
    }
  }

  // Note: Sentry performance measurement removed due to API changes
  // Can be re-added when Sentry API is updated
};

// Basic performance observer for web vitals
export const initWebVitals = async (options: { isDevelopment?: boolean } = {}) => {
  const config = { ...getMonitoringConfig(), ...options };

  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole();
    (window as any)._monitoringInterceptingConsole = true;
    try {
      console.log('📊 Web Vitals monitoring initialized (development mode)');
    } finally {
      (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
    }

    try {
      // Dynamic import of web-vitals
      const webVitalsModule = await import('web-vitals');
      webVitals = webVitalsModule;

      // Use the new web-vitals API (v5+)
      webVitals.onCLS((metric: any) => recordMetric('CLS', metric, 'unitless', { isDevelopment: config.isDevelopment }));
      webVitals.onFCP((metric: any) => recordMetric('FCP', metric, 'ms', { isDevelopment: config.isDevelopment }));
      webVitals.onLCP((metric: any) => recordMetric('LCP', metric, 'ms', { isDevelopment: config.isDevelopment }));
      webVitals.onTTFB((metric: any) => recordMetric('TTFB', metric, 'ms', { isDevelopment: config.isDevelopment }));
      // Note: FID is deprecated in web-vitals v5
    } catch (e) {
      const originalIsIntercepting = isInterceptingConsole();
      (window as any)._monitoringInterceptingConsole = true;
      try {
        console.warn('Web Vitals library not available - install web-vitals package');
      } finally {
        (window as any)._monitoringInterceptingConsole = originalIsIntercepting;
      }
    }
  }
};