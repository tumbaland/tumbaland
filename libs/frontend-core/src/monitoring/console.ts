// Console interception for automatic log capture

import { isInterceptingConsole, MonitoringContext, MonitoringLevel } from './config';

// Type for the capture message function
type CaptureMessageFn = (
  message: string,
  level: MonitoringLevel,
  context?: MonitoringContext
) => void;

type ConsoleMethodName = 'error' | 'warn' | 'log' | 'info' | 'debug';
type ConsoleMethod = (...args: unknown[]) => void;

// Initialize console interception
export const initConsoleInterception = (
  captureConsoleLevels: MonitoringLevel[] = ['error', 'warn'],
  captureMessageFn?: CaptureMessageFn
) => {
  // If no capture function provided, skip interception
  if (!captureMessageFn) return;

  // Helper function to conditionally intercept console methods
  const interceptConsole = (
    methodName: ConsoleMethodName,
    level: MonitoringLevel
  ) => {
    if (!captureConsoleLevels.includes(level)) return;

    const originalMethod = console[methodName] as ConsoleMethod;
    console[methodName] = ((...args: unknown[]) => {
      // Call original console method
      originalMethod.apply(console, args);

      // Prevent recursive interception by checking the global flag
      if (isInterceptingConsole()) return;

      // Send to logging API with recursion protection
      try {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        // Set interception flag to prevent recursion during capture
        window._monitoringInterceptingConsole = true;
        captureMessageFn(message, level, {
          source: `console.${methodName}`,
          args: args
        });
      } finally {
        window._monitoringInterceptingConsole = false;
      }
    }) as Console[typeof methodName];
  };

  // Intercept console methods based on configuration
  interceptConsole('error', 'error');
  interceptConsole('warn', 'warn');
  interceptConsole('log', 'info');
  interceptConsole('info', 'info');
  interceptConsole('debug', 'debug');
};
