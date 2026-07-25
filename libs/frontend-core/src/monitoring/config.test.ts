vi.mock('./console', () => ({ initConsoleInterception: vi.fn() }));
vi.mock('./errors', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { initConsoleInterception } from './console';
import { captureException } from './errors';
import { getMonitoringConfig, initMonitoring, isInterceptingConsole, updateMonitoringConfig } from './config';

describe('isInterceptingConsole', () => {
  afterEach(() => {
    delete (window as any)._monitoringInterceptingConsole;
  });

  it('is false when the global flag is unset', () => {
    expect(isInterceptingConsole()).toBe(false);
  });

  it('is true once the global flag is set', () => {
    (window as any)._monitoringInterceptingConsole = true;
    expect(isInterceptingConsole()).toBe(true);
  });
});

describe('getMonitoringConfig / updateMonitoringConfig', () => {
  it('merges partial updates into the existing config', () => {
    updateMonitoringConfig({ service: 'album-front', component: 'gallery' });

    const config = getMonitoringConfig();
    expect(config.service).toBe('album-front');
    expect(config.component).toBe('gallery');
  });

  it('preserves fields not included in the partial update', () => {
    updateMonitoringConfig({ service: 'first-service' });
    updateMonitoringConfig({ component: 'second-component' });

    const config = getMonitoringConfig();
    expect(config.service).toBe('first-service');
    expect(config.component).toBe('second-component');
  });
});

describe('initMonitoring', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('sets isDevelopment based on the environment argument and applies service/component/elkUrl', () => {
    initMonitoring('development', { service: 'finance-front', component: 'dashboard', elkUrl: 'http://elk.local' });

    const config = getMonitoringConfig();
    expect(config.isDevelopment).toBe(true);
    expect(config.service).toBe('finance-front');
    expect(config.component).toBe('dashboard');
    expect(config.elkUrl).toBe('http://elk.local');
  });

  it('treats any non-"development" environment as production', () => {
    initMonitoring('production');
    expect(getMonitoringConfig().isDevelopment).toBe(false);
  });

  it('does not log to the console in production — this is a published package, not just an in-repo app', () => {
    initMonitoring('production');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('defaults service/component to "frontend" and captureConsoleLevels to error+warn', () => {
    initMonitoring('development');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('error, warn'));
  });

  it('wires up console interception and window error handlers once the async imports resolve', async () => {
    initMonitoring('development', { captureConsoleLevels: ['error'] });

    // initMonitoring kicks off Promise.all(...).then(...) without awaiting it internally.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(initConsoleInterception).toHaveBeenCalledWith(['error'], expect.any(Function));

    const error = new Error('boom');
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom', filename: 'app.js', lineno: 1, colno: 2 }));

    expect(captureException).toHaveBeenCalledWith(error, { filename: 'app.js', lineno: 1, colno: 2 });
  });

  it('captures unhandled promise rejections as an Error via the window handler', async () => {
    initMonitoring('development');
    await new Promise((resolve) => setTimeout(resolve, 0));
    (captureException as ReturnType<typeof vi.fn>).mockClear();

    const event = new Event('unhandledrejection') as any;
    event.reason = 'network down';
    window.dispatchEvent(event);

    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unhandled promise rejection: network down' }),
      { type: 'unhandledrejection' }
    );
  });
});
