vi.mock('./config', () => ({ isInterceptingConsole: vi.fn(() => false) }));

import { isInterceptingConsole } from './config';
import { initConsoleInterception } from './console';

describe('initConsoleInterception', () => {
  const original = { error: console.error, warn: console.warn, log: console.log, info: console.info, debug: console.debug };

  afterEach(() => {
    console.error = original.error;
    console.warn = original.warn;
    console.log = original.log;
    console.info = original.info;
    console.debug = original.debug;
    delete (window as any)._monitoringInterceptingConsole;
    vi.clearAllMocks();
  });

  it('does nothing when no capture function is provided', () => {
    const errorBefore = console.error;
    initConsoleInterception(['error', 'warn']);
    expect(console.error).toBe(errorBefore);
  });

  it('only intercepts the console methods included in captureConsoleLevels', () => {
    const captureMessageFn = vi.fn();
    const logBefore = console.log;

    initConsoleInterception(['error'], captureMessageFn);

    expect(console.error).not.toBe(original.error);
    expect(console.log).toBe(logBefore);
  });

  it('calls the original console method and forwards to captureMessageFn with source/args context', () => {
    const captureMessageFn = vi.fn();
    const originalError = vi.fn();
    console.error = originalError;

    initConsoleInterception(['error'], captureMessageFn);
    console.error('something broke', { code: 42 });

    expect(originalError).toHaveBeenCalledWith('something broke', { code: 42 });
    expect(captureMessageFn).toHaveBeenCalledWith('something broke {"code":42}', 'error', {
      source: 'console.error',
      args: ['something broke', { code: 42 }]
    });
  });

  it('sets and clears the recursion-guard flag around each intercepted call', () => {
    const captureMessageFn = vi.fn(() => {
      expect((window as any)._monitoringInterceptingConsole).toBe(true);
    });
    console.error = vi.fn();

    initConsoleInterception(['error'], captureMessageFn);
    console.error('boom');

    expect((window as any)._monitoringInterceptingConsole).toBe(false);
  });

  it('skips forwarding to captureMessageFn when already inside an intercepted call (recursion guard)', () => {
    (isInterceptingConsole as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    const captureMessageFn = vi.fn();
    console.warn = vi.fn();

    initConsoleInterception(['warn'], captureMessageFn);
    console.warn('nested log');

    expect(captureMessageFn).not.toHaveBeenCalled();
  });

  it('maps console.log to the "info" level', () => {
    const captureMessageFn = vi.fn();
    console.log = vi.fn();

    initConsoleInterception(['info'], captureMessageFn);
    console.log('hello');

    expect(captureMessageFn).toHaveBeenCalledWith('hello', 'info', expect.objectContaining({ source: 'console.log' }));
  });
});
