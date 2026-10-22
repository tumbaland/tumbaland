import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import type { LiveShare } from '../types';

const api = vi.hoisted(() => ({
  startLive: vi.fn(),
  sendLivePosition: vi.fn(),
  stopLive: vi.fn()
}));
vi.mock('../services/chatApi', () => ({ chatApi: api }));

import { useDriveShare } from './useDriveShare';

const share = (overrides: Partial<LiveShare> = {}): LiveShare => ({
  userId: 'u-tom',
  name: 'Tom',
  position: null,
  startedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  destination: null,
  fixed: false,
  pinLabel: null,
  watchers: [],
  ...overrides
});

/** A phone's GPS the test moves. */
let onPosition: ((position: { coords: Partial<GeolocationCoordinates> }) => void) | null = null;
let onFailure: ((error: { code: number }) => void) | null = null;
const clearWatch = vi.fn();
const here = (lat: number, lng = 24.75) => ({
  coords: { latitude: lat, longitude: lng, accuracy: 8, heading: null, speed: null }
});
const released = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(Date.parse('2026-10-22T18:00:00Z'));
  Object.values(api).forEach((fn) => fn.mockReset());
  api.startLive.mockImplementation(async () => share());
  api.sendLivePosition.mockImplementation(async () => share());
  api.stopLive.mockResolvedValue(undefined);
  onPosition = null;
  onFailure = null;
  clearWatch.mockClear();
  released.mockClear();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) => ok(here(59.3)),
      watchPosition: (ok: typeof onPosition, fail: typeof onFailure) => {
        onPosition = ok;
        onFailure = fail;
        return 7;
      },
      clearWatch
    }
  });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn().mockResolvedValue({ release: released }) }
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const sharing = async () => {
  const onShare = vi.fn();
  const hook = renderHook(() => useDriveShare('c1', onShare));
  await act(() => hook.result.current.start());
  return { ...hook, onShare };
};

describe('useDriveShare', () => {
  it('starts with where the phone is, sends it, and keeps the screen on', async () => {
    const { result, onShare } = await sharing();

    expect(api.startLive).toHaveBeenCalledWith('c1', { fixed: false, pinLabel: null });
    expect(api.sendLivePosition).toHaveBeenCalledWith('c1', expect.objectContaining({ lat: 59.3, lng: 24.75 }));
    expect(result.current.state).toBe('sharing');
    expect(result.current.screen).toBe('on');
    expect(onShare).toHaveBeenCalled();
  });

  it('takes the destination marked, and the position the map already found', async () => {
    const onShare = vi.fn();
    const { result } = renderHook(() => useDriveShare('c1', onShare));

    await act(() =>
      result.current.start({ destination: { lat: 59.44, lng: 24.75 }, place: { lat: 59.2, lng: 24.7, accuracy: 9 } })
    );

    expect(api.startLive).toHaveBeenCalledWith('c1', {
      destination: { lat: 59.44, lng: 24.75 },
      fixed: false,
      pinLabel: null
    });
    expect(api.sendLivePosition).toHaveBeenCalledWith('c1', expect.objectContaining({ lat: 59.2, accuracy: 9 }));
    expect(result.current.pinned).toBe(false);
  });

  describe('a pin', () => {
    const pinning = async () => {
      const hook = renderHook(() => useDriveShare('c1', vi.fn()));
      await act(() => hook.result.current.start({ place: { lat: 59.42, lng: 24.7 }, pin: true }));
      return hook;
    };

    it('shares the place as it is, once, without the GPS or the screen', async () => {
      const { result } = await pinning();

      expect(api.startLive).toHaveBeenCalledWith('c1', { fixed: true, pinLabel: null });
      expect(api.sendLivePosition).toHaveBeenCalledWith('c1', {
        lat: 59.42,
        lng: 24.7,
        accuracy: null,
        heading: null,
        speed: null
      });
      expect(onPosition).toBeNull();
      expect(result.current.pinned).toBe(true);
      expect(result.current.screen).toBeNull();

      api.sendLivePosition.mockClear();
      await act(async () => vi.advanceTimersByTime(60_000));
      await act(async () => document.dispatchEvent(new Event('visibilitychange')));
      expect(api.sendLivePosition).not.toHaveBeenCalled();
    });

    it('sends again only if the first send did not get through', async () => {
      api.sendLivePosition.mockRejectedValueOnce(new Error('offline'));
      const { result } = await pinning();
      expect(result.current.sendFailing).toBe(true);

      await act(async () => vi.advanceTimersByTime(5_000));

      expect(api.sendLivePosition).toHaveBeenCalledTimes(2);
      expect(result.current.sendFailing).toBe(false);
    });

    it('is taken down on Stop', async () => {
      const { result } = await pinning();
      await act(() => result.current.stop());
      expect(api.stopLive).toHaveBeenCalledWith('c1');
      expect(result.current.pinned).toBe(false);
    });
  });

  it('sends a position once the car has moved, and not for GPS wobble', async () => {
    const { result } = await sharing();
    api.sendLivePosition.mockClear();

    act(() => onPosition?.(here(59.30001)));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(api.sendLivePosition).not.toHaveBeenCalled();

    act(() => onPosition?.(here(59.31)));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(api.sendLivePosition).toHaveBeenCalledWith('c1', expect.objectContaining({ lat: 59.31 }));
    expect(result.current.lastSentAt).not.toBeNull();
  });

  it('still says it is there every half minute when standing still', async () => {
    await sharing();
    api.sendLivePosition.mockClear();

    await act(async () => vi.advanceTimersByTime(30_000));

    expect(api.sendLivePosition).toHaveBeenCalledTimes(1);
  });

  it('keeps the heartbeat going while standing still, asking the GPS when it goes quiet', async () => {
    const asked = vi.fn((ok: (p: unknown) => void) => ok(here(59.3)));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: asked, watchPosition: () => 7, clearWatch }
    });
    await sharing();
    api.sendLivePosition.mockClear();
    asked.mockClear();

    // Two minutes at a red light: the watch says nothing the whole time.
    await act(() => vi.advanceTimersByTimeAsync(120_000));

    expect(asked).toHaveBeenCalled();
    expect(api.sendLivePosition.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps going when the GPS cannot answer outright', async () => {
    const asked = vi.fn((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 3 }));
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: unknown) => void) => ok(here(59.3)),
        watchPosition: () => 7,
        clearWatch
      }
    });
    const { result } = await sharing();
    navigator.geolocation.getCurrentPosition = asked as never;

    await act(async () => vi.advanceTimersByTime(30_000));

    expect(asked).toHaveBeenCalled();
    expect(result.current.state).toBe('sharing');
  });

  it('keeps trying through a lost signal, and says so', async () => {
    const { result } = await sharing();
    api.sendLivePosition.mockRejectedValue(new Error('offline'));

    act(() => onPosition?.(here(59.4)));
    await act(async () => vi.advanceTimersByTime(5_000));

    expect(result.current.sendFailing).toBe(true);
    expect(result.current.state).toBe('sharing');
  });

  it('stops here when the share has ended on the server', async () => {
    const { result, onShare } = await sharing();
    api.sendLivePosition.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }));

    act(() => onPosition?.(here(59.4)));
    await act(async () => vi.advanceTimersByTime(5_000));

    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBe('Sharing has ended.');
    expect(onShare).toHaveBeenLastCalledWith(null);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('ends when its time is up', async () => {
    const { result } = await sharing();

    await act(async () => vi.advanceTimersByTime(61 * 60_000));

    expect(result.current.state).toBe('idle');
    expect(api.stopLive).toHaveBeenCalledWith('c1');
  });

  it('ends if the location is blocked midway', async () => {
    const { result } = await sharing();

    await act(async () => onFailure?.({ code: 1 }));

    expect(result.current.state).toBe('idle');
    expect(result.current.error).toMatch(/blocked/);
  });

  it('keeps going through a moment without signal from the GPS', async () => {
    const { result } = await sharing();
    act(() => onFailure?.({ code: 3 }));
    expect(result.current.state).toBe('sharing');
  });

  it('stops everywhere on Stop, and lets go of the screen', async () => {
    const { result, onShare } = await sharing();

    await act(() => result.current.stop());

    expect(api.stopLive).toHaveBeenCalledWith('c1');
    expect(onShare).toHaveBeenLastCalledWith(null);
    expect(released).toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('sends again at once when the page comes back on screen', async () => {
    await sharing();
    api.sendLivePosition.mockClear();

    await act(async () => document.dispatchEvent(new Event('visibilitychange')));

    expect(api.sendLivePosition).toHaveBeenCalledTimes(1);
  });

  it('says why it could not start, and starts nothing', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }) }
    });
    const { result } = renderHook(() => useDriveShare('c1', vi.fn()));

    await act(() => result.current.start());

    expect(result.current.state).toBe('idle');
    expect(result.current.error).toMatch(/blocked/);
    expect(api.startLive).not.toHaveBeenCalled();
  });

  it('says so when the server will not start it', async () => {
    api.startLive.mockRejectedValue(Object.assign(new Error('nope'), { status: 500 }));
    const { result } = renderHook(() => useDriveShare('c1', vi.fn()));

    await act(() => result.current.start());

    expect(result.current.error).toBe('Could not start sharing. Try again.');
  });

  it('says when the screen cannot be kept on', async () => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
    const { result } = await sharing();
    expect(result.current.screen).toBe('unavailable');
  });

  it('stops sending, but leaves the share, when the conversation is left', async () => {
    const { unmount } = await sharing();

    unmount();

    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(api.stopLive).not.toHaveBeenCalled();
  });

  it('releases the old conversation before starting in another one', async () => {
    const onShare = vi.fn();
    const { result, rerender } = renderHook(({ id }) => useDriveShare(id, onShare), { initialProps: { id: 'c1' } });
    await act(() => result.current.start());
    const oldPosition = onPosition;
    rerender({ id: 'c2' });
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(result.current.state).toBe('idle');
    expect(result.current.position).toBeNull();

    api.sendLivePosition.mockClear();
    act(() => oldPosition?.(here(59.9)));
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(api.sendLivePosition).not.toHaveBeenCalled();
    await act(() => result.current.start());
    expect(api.sendLivePosition).toHaveBeenLastCalledWith('c2', expect.objectContaining({ lat: 59.3 }));
  });

  it('does not start a share after Stop while waiting for GPS', async () => {
    let located!: PositionCallback;
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((ok) => {
      located = ok;
    });
    const { result } = renderHook(() => useDriveShare('c1', vi.fn()));
    let starting!: Promise<void>;
    act(() => {
      starting = result.current.start();
    });
    await act(() => result.current.stop());
    await act(async () => {
      located(here(59.3) as GeolocationPosition);
      await starting;
    });
    expect(api.startLive).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('deletes after a pending start completes when Stop was pressed', async () => {
    let finish!: (value: LiveShare) => void;
    api.startLive.mockReturnValue(
      new Promise<LiveShare>((resolve) => {
        finish = resolve;
      })
    );
    const onShare = vi.fn();
    const { result } = renderHook(() => useDriveShare('c1', onShare));
    let starting!: Promise<void>;
    act(() => {
      starting = result.current.start({ place: { lat: 59.3, lng: 24.75 } });
    });
    let stopping!: Promise<void>;
    act(() => {
      stopping = result.current.stop();
    });
    expect(result.current.state).toBe('stopping');
    expect(api.stopLive).not.toHaveBeenCalled();
    await act(async () => {
      finish(share());
      await starting;
      await stopping;
    });
    expect(api.stopLive).toHaveBeenCalledWith('c1');
    expect(api.sendLivePosition).not.toHaveBeenCalled();
    expect(onShare).toHaveBeenCalledExactlyOnceWith(null);
    expect(result.current.state).toBe('idle');
  });

  it('keeps the server share visible and reports a failed Stop so it can be retried', async () => {
    const { result, onShare } = await sharing();
    onShare.mockClear();
    api.stopLive.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.stop());
    expect(onShare).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/last location may still be visible/);
    expect(clearWatch).toHaveBeenCalledWith(7);
    await act(() => result.current.stop());
    expect(onShare).toHaveBeenCalledWith(null);
    expect(result.current.error).toBeNull();
  });

  it('cleans up a start that completes after leaving the conversation', async () => {
    let finish!: (value: LiveShare) => void;
    api.startLive.mockReturnValueOnce(
      new Promise<LiveShare>((resolve) => {
        finish = resolve;
      })
    );
    const onShare = vi.fn();
    const { result, unmount } = renderHook(() => useDriveShare('c1', onShare));
    let starting!: Promise<void>;
    act(() => {
      starting = result.current.start({ place: { lat: 59.3, lng: 24.75 } });
    });
    unmount();
    await act(async () => {
      finish(share());
      await starting;
    });
    expect(api.stopLive).toHaveBeenCalledWith('c1');
    expect(api.sendLivePosition).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
  });

  it('does not mark an old GPS fix as fresh indefinitely', async () => {
    await sharing();
    // No fix at all: the watch is silent and asking outright gets nothing either.
    navigator.geolocation.getCurrentPosition = ((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 3 })) as never;
    await act(async () => vi.advanceTimersByTime(65_000));
    api.sendLivePosition.mockClear();
    await act(async () => vi.advanceTimersByTime(60_000));
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(api.sendLivePosition).not.toHaveBeenCalled();
    act(() => onPosition?.(here(59.4)));
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(api.sendLivePosition).toHaveBeenCalledWith('c1', expect.objectContaining({ lat: 59.4 }));
  });

  it('keeps one position request in flight on a slow connection', async () => {
    let finish!: (value: LiveShare) => void;
    api.sendLivePosition.mockReturnValueOnce(
      new Promise<LiveShare>((resolve) => {
        finish = resolve;
      })
    );
    await sharing();
    act(() => onPosition?.(here(59.4)));
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(api.sendLivePosition).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(share());
    });
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(api.sendLivePosition).toHaveBeenCalledTimes(2);
  });

  it('releases a wake lock that arrives after Stop', async () => {
    let acquired!: (sentinel: WakeLockSentinel) => void;
    vi.mocked(navigator.wakeLock.request).mockReturnValueOnce(
      new Promise<WakeLockSentinel>((resolve) => {
        acquired = resolve;
      })
    );
    const { result } = renderHook(() => useDriveShare('c1', vi.fn()));
    let starting!: Promise<void>;
    await act(async () => {
      starting = result.current.start();
    });
    await act(() => result.current.stop());
    await act(async () => {
      acquired({ release: released } as unknown as WakeLockSentinel);
      await starting;
    });
    expect(released).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBeNull();
  });
});
