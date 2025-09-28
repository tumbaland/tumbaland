// Error and message tracking

import { getMonitoringConfig, isInterceptingConsole } from './config';
import { queueLog } from './batch';
import { generateCorrelationId } from './utils';

// Error tracking with local ELK logging
export const captureException = async (
  error: Error,
  context?: any,
  options: {
    isDevelopment?: boolean;
    service?: string;
    component?: string;
    elkUrl?: string;
  } = {}
) => {
  const config = { ...getMonitoringConfig(), ...options };

  const errorData = {
    timestamp: new Date().toISOString(),
    level: 'error',
    service: config.service,
    component: config.component,
    message: error.message,
    stack: error.stack,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    context: context || {},
    correlationId: generateCorrelationId()
  };

  // Always log to console for development
  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole;
    (window as any).isInterceptingConsole = true;
    try {
      console.error('🚨 Frontend Error:', errorData);
    } finally {
      (window as any).isInterceptingConsole = originalIsIntercepting;
    }
  }

  // Send to local ELK stack if available (batched)
  if (config.elkUrl) {
    queueLog(errorData);
  }
};

export const captureMessage = async (
  message: string,
  level: 'debug' | 'info' | 'warn' | 'error' = 'info',
  context?: any,
  options: {
    isDevelopment?: boolean;
    service?: string;
    component?: string;
    elkUrl?: string;
  } = {}
) => {
  const config = { ...getMonitoringConfig(), ...options };

  const logData = {
    timestamp: new Date().toISOString(),
    level: level.toLowerCase(),
    service: config.service,
    component: config.component,
    message,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    context: context || {},
    correlationId: generateCorrelationId()
  };

  // Always log to console for development
  if (config.isDevelopment) {
    const originalIsIntercepting = isInterceptingConsole;
    (window as any).isInterceptingConsole = true;
    try {
      const logLevel = level.toUpperCase();
      console.log(`[${logLevel}] ${message}`, context || '');
    } finally {
      (window as any).isInterceptingConsole = originalIsIntercepting;
    }
  }

  // Send to local ELK stack if available (batched)
  if (config.elkUrl) {
    queueLog(logData);
  }
};