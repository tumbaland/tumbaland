// Small frontend logger — routes through the same captureMessage/captureException
// pipeline as console interception, but as an explicit call so it's captured
// regardless of the per-app captureConsoleLevels configuration (which usually only
// intercepts 'error'/'warn'), and carries structured context instead of a string blob.
import { captureException, captureMessage } from './errors';

// Fire and forget: the capture functions are async but have nothing a caller
// could wait for, so the logger returns nothing rather than a promise every
// call site would have to ignore.
export const logger = {
  debug: (message: string, context?: Record<string, unknown>): void => {
    void captureMessage(message, 'debug', context);
  },
  info: (message: string, context?: Record<string, unknown>): void => {
    void captureMessage(message, 'info', context);
  },
  warn: (message: string, context?: Record<string, unknown>): void => {
    void captureMessage(message, 'warn', context);
  },
  error: (message: string, error?: unknown, context?: Record<string, unknown>): void => {
    if (error instanceof Error) {
      void captureException(error, { message, ...context });
    } else {
      void captureMessage(message, 'error', error !== undefined ? { error, ...context } : context);
    }
  }
};
