vi.mock('./config', () => ({ getMonitoringConfig: vi.fn() }));

import { getMonitoringConfig } from './config';

/**
 * batch.ts keeps a module-level logBatch/batchTimeout singleton (and
 * registers a `beforeunload` listener as an import-time side effect), so
 * each scenario gets its own fresh module instance. Stale listeners from
 * earlier fresh instances stay registered on jsdom's shared `window`, but
 * their own private logBatch is always empty, so they no-op harmlessly.
 */
async function freshBatch() {
  vi.resetModules();
  return import('./batch');
}

function mockConfig(overrides: Partial<ReturnType<typeof getMonitoringConfig>> = {}) {
  (getMonitoringConfig as ReturnType<typeof vi.fn>).mockReturnValue({
    isDevelopment: false,
    service: 'test-service',
    component: 'test-component',
    ...overrides
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('queueLog', () => {
  it('does not send anything when no elkUrl is configured, even after the batch interval elapses', async () => {
    mockConfig();
    vi.useFakeTimers();
    const { queueLog } = await freshBatch();

    queueLog({ message: 'hello' });
    await vi.advanceTimersByTimeAsync(6000);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('schedules and sends the batch after the batch interval when elkUrl is configured', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    vi.useFakeTimers();
    const { queueLog } = await freshBatch();

    queueLog({ message: 'hello' });
    expect(global.fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(6000);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://elk.local',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ message: 'hello' }])
      })
    );
  });

  it('sends immediately, without waiting for the timer, once the batch reaches 10 items', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    const { queueLog } = await freshBatch();

    for (let i = 0; i < 10; i++) queueLog({ message: `log-${i}` });
    // sendBatch is fire-and-forget (not awaited by queueLog) — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toHaveLength(10);
  });

  it('clears any pending scheduled send when the immediate 10-item send fires', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    vi.useFakeTimers();
    const { queueLog } = await freshBatch();

    for (let i = 0; i < 10; i++) queueLog({ message: `log-${i}` });
    await vi.advanceTimersByTimeAsync(0);
    // If the scheduled timeout weren't cleared, it would fire a second, empty send later.
    await vi.advanceTimersByTimeAsync(6000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('flushLogs', () => {
  it('sends any queued logs immediately and clears a pending timer', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    vi.useFakeTimers();
    const { queueLog, flushLogs } = await freshBatch();

    queueLog({ message: 'hello' });
    await flushLogs();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // The scheduled timer should have been cleared by flushLogs, so no second send.
    await vi.advanceTimersByTimeAsync(6000);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when there is nothing queued', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    const { flushLogs } = await freshBatch();

    await flushLogs();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('sendBatch failure handling', () => {
  it('drops the batch and warns, without recursing into console interception, on a non-ok response', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const { queueLog, flushLogs } = await freshBatch();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    queueLog({ message: 'will fail' });
    await flushLogs();

    expect(warnSpy).toHaveBeenCalledWith('Failed to send log batch, dropping logs:', expect.any(Error));
    // console.warn must be restored to the spy afterward, not left disabled by the
    // temporary "console.warn = () => {}" swap inside sendBatch's catch block.
    expect(console.warn).toBe(warnSpy);
    warnSpy.mockRestore();
  });

  it('also logs each dropped log individually in development', async () => {
    mockConfig({ elkUrl: 'http://elk.local', isDevelopment: true });
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const { queueLog, flushLogs } = await freshBatch();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    queueLog({ message: 'dropped-1' });
    await flushLogs();

    expect(warnSpy).toHaveBeenCalledWith('📝 [DROPPED LOG]:', JSON.stringify({ message: 'dropped-1' }));
    warnSpy.mockRestore();
  });

  it('does not log dropped-log details outside development', async () => {
    mockConfig({ elkUrl: 'http://elk.local', isDevelopment: false });
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const { queueLog, flushLogs } = await freshBatch();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    queueLog({ message: 'dropped-1' });
    await flushLogs();

    expect(warnSpy).not.toHaveBeenCalledWith('📝 [DROPPED LOG]:', expect.anything());
    warnSpy.mockRestore();
  });
});

describe('beforeunload handler', () => {
  it('uses sendBeacon to flush any queued logs synchronously on page unload', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
    const { queueLog } = await freshBatch();

    queueLog({ message: 'unload-me' });
    window.dispatchEvent(new Event('beforeunload'));

    expect(sendBeacon).toHaveBeenCalledWith('http://elk.local', expect.any(Blob));
  });

  it('does not call sendBeacon when there is nothing queued', async () => {
    mockConfig({ elkUrl: 'http://elk.local' });
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
    await freshBatch();

    window.dispatchEvent(new Event('beforeunload'));

    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
