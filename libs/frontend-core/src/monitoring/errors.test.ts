vi.mock('./config', () => ({
  getMonitoringConfig: vi.fn(() => ({ isDevelopment: false, service: 'test-service', component: 'test-component' })),
  isInterceptingConsole: vi.fn(() => false)
}));
vi.mock('./batch', () => ({ queueLog: vi.fn() }));
vi.mock('./utils', () => ({ getCorrelationId: vi.fn(() => 'corr-1'), getSessionId: vi.fn(() => 'sess-1') }));

import { getMonitoringConfig } from './config';
import { queueLog } from './batch';
import { captureException, captureMessage } from './errors';

describe('captureException', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isDevelopment: false,
      service: 'test-service',
      component: 'test-component'
    });
  });

  it('does not log to console or queue when not in development and no elkUrl', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await captureException(new Error('boom'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(queueLog).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('logs to console when isDevelopment is true, guarding the recursion flag around it', async () => {
    (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isDevelopment: true,
      service: 'test-service',
      component: 'test-component'
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await captureException(new Error('boom'));

    expect(consoleErrorSpy).toHaveBeenCalledWith('🚨 Frontend Error:', expect.objectContaining({ message: 'boom' }));
    consoleErrorSpy.mockRestore();
  });

  it('queues the error payload when elkUrl is configured, with correlation/session ids', async () => {
    (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isDevelopment: false,
      service: 'test-service',
      component: 'test-component',
      elkUrl: 'http://elk.local'
    });

    const err = new Error('boom');
    await captureException(err, { extra: 1 });

    expect(queueLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'boom',
        service: 'test-service',
        component: 'test-component',
        context: { extra: 1 },
        correlationId: 'corr-1',
        sessionId: 'sess-1'
      })
    );
  });

  it('lets per-call options override the global monitoring config', async () => {
    await captureException(new Error('boom'), undefined, { service: 'override-service', elkUrl: 'http://elk.local' });

    expect(queueLog).toHaveBeenCalledWith(expect.objectContaining({ service: 'override-service' }));
  });
});

describe('captureMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isDevelopment: false,
      service: 'test-service',
      component: 'test-component'
    });
  });

  it('defaults to "info" level', async () => {
    (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isDevelopment: false,
      service: 'test-service',
      component: 'test-component',
      elkUrl: 'http://elk.local'
    });

    await captureMessage('hello');

    expect(queueLog).toHaveBeenCalledWith(expect.objectContaining({ level: 'info', message: 'hello' }));
  });

  it('logs to console with an uppercased level tag when isDevelopment is true', async () => {
    (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      isDevelopment: true,
      service: 'test-service',
      component: 'test-component'
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await captureMessage('hello there', 'warn', { foo: 1 });

    expect(consoleLogSpy).toHaveBeenCalledWith('[WARN] hello there', { foo: 1 });
    consoleLogSpy.mockRestore();
  });

  it('does not queue when no elkUrl is configured', async () => {
    await captureMessage('hello', 'debug');
    expect(queueLog).not.toHaveBeenCalled();
  });
});
