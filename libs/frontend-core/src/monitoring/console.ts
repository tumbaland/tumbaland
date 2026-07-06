// Console interception for automatic log capture

import { isInterceptingConsole } from './config';

// Type for the capture message function
type CaptureMessageFn = (
  message: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  context?: any
) => void;

// Initialize console interception
export const initConsoleInterception = (
  captureConsoleLevels: ('debug' | 'info' | 'warn' | 'error')[] = ['error', 'warn'],
  captureMessageFn?: CaptureMessageFn
) => {
  // If no capture function provided, skip interception
  if (!captureMessageFn) return;

  // Helper function to conditionally intercept console methods
  const interceptConsole = (
    methodName: keyof Console,
    level: 'debug' | 'info' | 'warn' | 'error'
  ) => {
    if (!captureConsoleLevels.includes(level)) return;

    const originalMethod = (console as any)[methodName];
    (console as any)[methodName] = (...args: any[]) => {
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
        (window as any)._monitoringInterceptingConsole = true;
        captureMessageFn(message, level, {
          source: `console.${methodName}`,
          args: args
        });
      } finally {
        (window as any)._monitoringInterceptingConsole = false;
      }
    };
  };

  // Intercept console methods based on configuration
  interceptConsole('error', 'error');
  interceptConsole('warn', 'warn');
  interceptConsole('log', 'info');
  interceptConsole('info', 'info');
  interceptConsole('debug', 'debug');
};