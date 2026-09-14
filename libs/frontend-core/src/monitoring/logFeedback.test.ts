import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * batch, console and errors are each tested elsewhere with the others mocked,
 * which is how a loop between them went unnoticed: a failed send warned through
 * the intercepted console, the warning was captured as a new log, and in
 * development the dropped-log dump refilled the batch past its size limit so it
 * sent again at once. With the log endpoint down that spun without pause and
 * froze the page. These run the real modules together.
 */

const METHODS = ['log', 'info', 'debug', 'warn', 'error'] as const;
const nativeConsole = Object.fromEntries(METHODS.map((m) => [m, console[m]])) as Pick<Console, (typeof METHODS)[number]>;

async function loadMonitoring(options: { isDevelopment: boolean }) {
  vi.resetModules();
  const config = await import('./config');
  const { initConsoleInterception } = await import('./console');
  const { captureMessage } = await import('./errors');

  config.updateMonitoringConfig({
    isDevelopment: options.isDevelopment,
    service: 'test-service',
    component: 'frontend',
    elkUrl: 'http://logs.local/logs'
  });
  // Grab the silenced warn before interception wraps it.
  const warn = console.warn as ReturnType<typeof vi.fn>;
  initConsoleInterception(['error', 'warn'], captureMessage);

  return { captureMessage, warn };
}

/** Let fetch rejections, catch blocks and any re-sends they trigger run out. */
async function settle(ticks = 50) {
  for (let i = 0; i < ticks; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  for (const method of METHODS) vi.spyOn(console, method).mockImplementation(() => {});
  global.fetch = vi.fn().mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource.'));
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(console, nativeConsole);
  window._monitoringInterceptingConsole = false;
});

it('tries once and stops when the log endpoint is down in development', async () => {
  const { captureMessage, warn } = await loadMonitoring({ isDevelopment: true });

  for (let i = 0; i < 10; i++) captureMessage(`request ${i} failed`, 'error');
  await settle();

  expect(global.fetch).toHaveBeenCalledTimes(1);
  // The failure is still reported, just not fed back into the queue.
  expect(warn).toHaveBeenCalledWith('Failed to send log batch, dropping logs:', expect.any(TypeError));
});

it('does not queue its own failure report for sending outside development either', async () => {
  vi.useFakeTimers();
  try {
    const { captureMessage } = await loadMonitoring({ isDevelopment: false });

    for (let i = 0; i < 10; i++) captureMessage(`request ${i} failed`, 'error');
    // Well past the batch interval: anything queued by the failure would go out here.
    await vi.advanceTimersByTimeAsync(60_000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
