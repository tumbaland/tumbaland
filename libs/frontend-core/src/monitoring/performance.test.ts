vi.mock('./config', () => ({
  getMonitoringConfig: vi.fn(() => ({ isDevelopment: false, service: 'test-service', component: 'test-component' })),
  isInterceptingConsole: vi.fn(() => false)
}));

vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn()
}));

import { getMonitoringConfig } from './config';
import { initWebVitals, recordMetric, setTag, setUser, startTransaction } from './performance';

function mockConfig(overrides: Partial<ReturnType<typeof getMonitoringConfig>> = {}) {
  (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
    isDevelopment: false,
    service: 'test-service',
    component: 'test-component',
    ...overrides
  });
}

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockConfig();
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  delete (window as unknown as Record<string, unknown>)._monitoringInterceptingConsole;
});

describe('setUser', () => {
  it('does not log when not in development', () => {
    setUser({ id: 'u1' });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('logs the user in development', () => {
    setUser({ id: 'u1', email: 'a@b.com' }, { isDevelopment: true });
    expect(consoleLogSpy).toHaveBeenCalledWith('👤 User set:', { id: 'u1', email: 'a@b.com' });
  });
});

describe('setTag', () => {
  it('logs the key/value pair in development', () => {
    setTag('feature', 'collage-v2', { isDevelopment: true });
    expect(consoleLogSpy).toHaveBeenCalledWith('🏷️ Tag set: feature = collage-v2');
  });

  it('does not log outside development', () => {
    setTag('feature', 'collage-v2');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

describe('startTransaction', () => {
  it('logs a start message in development and returns a finish() handle', () => {
    const tx = startTransaction('load-dashboard', 'navigation', { isDevelopment: true });

    expect(consoleLogSpy).toHaveBeenCalledWith('⏱️ Transaction started: load-dashboard (navigation)');
    expect(typeof tx.finish).toBe('function');
  });

  it('finish() records a duration metric and logs completion in development', () => {
    const tx = startTransaction('load-dashboard', 'navigation', { isDevelopment: true });
    consoleLogSpy.mockClear();

    tx.finish();

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Performance: load-dashboard_duration'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Transaction finished: load-dashboard'));
  });

  it('does not log in production, including on finish()', () => {
    const tx = startTransaction('load-dashboard', 'navigation');
    tx.finish();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

describe('recordMetric', () => {
  it('accepts a plain number value', () => {
    recordMetric('LCP', 1234.5, 'ms', { isDevelopment: true });
    expect(consoleLogSpy).toHaveBeenCalledWith('📊 Performance: LCP = 1234.50ms');
  });

  it('accepts a { value } metric object (as web-vitals callbacks provide)', () => {
    recordMetric('CLS', { value: 0.05, id: 'v1' }, 'unitless', { isDevelopment: true });
    expect(consoleLogSpy).toHaveBeenCalledWith('📊 Performance: CLS = 0.05unitless');
  });

  it('does not log outside development', () => {
    recordMetric('LCP', 100);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

describe('initWebVitals', () => {
  it('does nothing outside development', async () => {
    await initWebVitals();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('logs an init message and wires up web-vitals callbacks in development', async () => {
    await initWebVitals({ isDevelopment: true });

    expect(consoleLogSpy).toHaveBeenCalledWith('📊 Web Vitals monitoring initialized (development mode)');
  });

  it('records a metric once a web-vitals callback fires', async () => {
    await initWebVitals({ isDevelopment: true });
    consoleLogSpy.mockClear();

    const webVitals = await import('web-vitals');
    (webVitals.onLCP as ReturnType<typeof vi.fn>).mock.calls[0][0]({ value: 2500 });

    expect(consoleLogSpy).toHaveBeenCalledWith('📊 Performance: LCP = 2500.00ms');
  });
});
