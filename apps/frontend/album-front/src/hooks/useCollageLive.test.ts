import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCollageLive } from './useCollageLive';

vi.mock('../services/collageService', () => ({
  collageService: {
    liveUrl: (id: string, session: string) => `https://album.example/api/collages/${id}/live?session=${session}`
  }
}));

/** A stand-in EventSource the test can speak through. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  onerror: (() => void) | null = null;
  closed = false;
  constructor(
    public url: string,
    public init?: EventSourceInit
  ) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data: JSON.stringify(data) } as MessageEvent);
  }
  static latest() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
  }
}

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

const handlers = () => ({ onChanges: vi.fn(), onPresence: vi.fn(), onRevision: vi.fn() });

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCollageLive', () => {
  it('opens the collage’s stream for this tab, with the session cookie', () => {
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...handlers() }));

    expect(FakeEventSource.latest().url).toBe('https://album.example/api/collages/c1/live?session=tab-1');
    expect(FakeEventSource.latest().init).toEqual({ withCredentials: true });
  });

  it('passes on the revision, changes and who is here', () => {
    const on = handlers();
    const { result } = renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...on }));
    const stream = FakeEventSource.latest();

    act(() => stream.emit('ready', { heartbeatMs: 25_000, revision: 7 }));
    act(() =>
      stream.emit('changes', {
        revision: 8,
        changes: [{ type: 'remove', layer: 'photos', id: 'a' }],
        by: { userId: 'u2', name: 'Irja' }
      })
    );
    act(() =>
      stream.emit('presence', {
        viewers: [{ session: 'tab-2', userId: 'u2', name: 'Irja', picture: null, selection: 'a' }]
      })
    );

    expect(result.current.connected).toBe(true);
    expect(on.onRevision).toHaveBeenCalledWith(7);
    expect(on.onChanges).toHaveBeenCalledWith(8, [{ type: 'remove', layer: 'photos', id: 'a' }], {
      userId: 'u2',
      name: 'Irja'
    });
    expect(on.onPresence).toHaveBeenCalledWith([expect.objectContaining({ name: 'Irja', selection: 'a' })]);
  });

  it('passes on where someone has an item mid-drag', () => {
    const onMoving = vi.fn();
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...handlers(), onMoving }));
    const item = { id: 'a', x: 5, y: 6, width: 10, height: 10 };

    act(() => FakeEventSource.latest().emit('moving', { userId: 'u2', name: 'Irja', item }));

    expect(onMoving).toHaveBeenCalledWith({ userId: 'u2', name: 'Irja', item });
  });

  it('says when the collage’s albums have new photos, for the tray to fetch again', () => {
    const onPhotos = vi.fn();
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...handlers(), onPhotos }));

    act(() => FakeEventSource.latest().emit('photos', {}));

    expect(onPhotos).toHaveBeenCalledTimes(1);
  });

  it('refreshes photos on the first connection and reconnection to cover missed events', () => {
    const onPhotos = vi.fn();
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...handlers(), onPhotos }));
    act(() => FakeEventSource.latest().emit('ready', { heartbeatMs: 25_000, revision: 1 }));
    expect(onPhotos).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    act(() => FakeEventSource.latest().emit('ready', { heartbeatMs: 25_000, revision: 1 }));

    expect(onPhotos).toHaveBeenCalledTimes(2);
  });

  it('treats a whole-collage save as a revision to catch up to', () => {
    const on = handlers();
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...on }));

    act(() => FakeEventSource.latest().emit('reload', { revision: 12 }));

    expect(on.onRevision).toHaveBeenCalledWith(12);
  });

  it('reconnects after an error, and after going quiet', () => {
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...handlers() }));
    const first = FakeEventSource.latest();

    act(() => first.onerror?.());
    expect(first.closed).toBe(true);
    act(() => vi.advanceTimersByTime(2500));
    expect(FakeEventSource.instances).toHaveLength(2);

    act(() => FakeEventSource.latest().emit('ready', { heartbeatMs: 1000, revision: 1 }));
    act(() => vi.advanceTimersByTime(2100));
    expect(FakeEventSource.instances[1]!.closed).toBe(true);
  });

  it('closes while the tab is hidden, forgetting who was here, and reopens on return', () => {
    const on = handlers();
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...on }));

    act(() => setVisibility('hidden'));
    expect(FakeEventSource.latest().closed).toBe(true);
    expect(on.onPresence).toHaveBeenLastCalledWith([]);

    act(() => setVisibility('visible'));
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('gives up quietly when the collage has too many tabs open', () => {
    renderHook(() => useCollageLive({ collageId: 'c1', session: 'tab-1', ...handlers() }));

    act(() => FakeEventSource.latest().emit('ready', { error: 'too_many_viewers' }));
    act(() => vi.advanceTimersByTime(60_000));

    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
