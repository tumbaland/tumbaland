import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { renderHook, act } from '@testing-library/react';
import { FAILURES_BEFORE_POLLING, POLL_INTERVAL_MS, useChatStream } from './useChatStream';

vi.mock('../services/chatApi', () => ({
  chatApi: { streamUrl: () => 'https://chat-api.test/api/chat/stream' }
}));

/** A stand-in for EventSource, so the hook's reconnect logic can be driven. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  closed = false;
  listeners = new Map<string, (event: MessageEvent) => void>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.listeners.set(type, handler);
  }

  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** Test helper: the server accepting the connection. */
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  /** Test helper: an event arriving. */
  emit(type: string, data: unknown, lastEventId = '') {
    this.listeners.get(type)?.({ data: JSON.stringify(data), lastEventId } as MessageEvent);
  }

  /** Test helper: the connection failing for good. */
  fail() {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
}

const ready = { type: 'conversation.updated', conversationId: '', at: 1, payload: { ready: true, heartbeatMs: 25000 } };

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const latest = () => FakeEventSource.instances.at(-1)!;

describe('connecting', () => {
  it('opens a stream on mount', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(latest().url).toContain('/api/chat/stream');
  });

  it('reports live once the connection opens', () => {
    const onStateChange = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn(), onStateChange }));

    act(() => latest().open());

    expect(onStateChange).toHaveBeenCalledWith('live');
  });

  it('does not connect at all when disabled', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn(), enabled: false }));

    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('closes the stream on unmount', () => {
    const { unmount } = renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    const stream = latest();

    unmount();

    expect(stream.closed).toBe(true);
  });
});

describe('events', () => {
  it('passes a parsed event to the caller', () => {
    const onEvent = vi.fn();
    renderHook(() => useChatStream({ onEvent, onResync: vi.fn() }));
    act(() => latest().open());

    const event = { type: 'message.created', conversationId: 'c1', at: 2, payload: { id: 'm1' } };
    act(() => latest().emit('message.created', event));

    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('swallows an unreadable frame rather than crashing the stream', () => {
    const onEvent = vi.fn();
    renderHook(() => useChatStream({ onEvent, onResync: vi.fn() }));
    act(() => latest().open());

    act(() => latest().listeners.get('message.created')?.({ data: 'not json' } as MessageEvent));

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('does not forward the server’s ready frame as an ordinary event', () => {
    const onEvent = vi.fn();
    renderHook(() => useChatStream({ onEvent, onResync: vi.fn() }));
    act(() => latest().open());

    act(() => latest().emit('conversation.updated', ready));

    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe('the heartbeat watchdog', () => {
  it('rebuilds a connection that has gone quiet', () => {
    // iOS suspends a backgrounded EventSource without firing an error: the
    // connection looks open and delivers nothing. Only a watchdog notices.
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    act(() => latest().open());
    const first = latest();

    act(() => {
      vi.advanceTimersByTime(25_000 * 2 + 100);
    });

    expect(first.closed).toBe(true);
  });

  it('keeps an idle connection alive using heartbeat events without forwarding them', () => {
    const onEvent = vi.fn();
    renderHook(() => useChatStream({ onEvent, onResync: vi.fn() }));
    act(() => latest().open());
    const stream = latest();
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(25_000);
        stream.emit('heartbeat', {});
      });
    }
    expect(stream.closed).toBe(false);
    expect(onEvent).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('stays connected while traffic keeps arriving', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    act(() => latest().open());
    const first = latest();

    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(20_000);
        first.emit('message.created', { type: 'message.created', conversationId: 'c1', at: i, payload: {} });
      });
    }

    expect(first.closed).toBe(false);
  });
});

describe('reconnecting', () => {
  it('resyncs after a transient transport error, not just a CLOSED error', () => {
    const onResync = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync }));
    act(() => latest().open());
    act(() => {
      latest().readyState = FakeEventSource.CONNECTING;
      latest().onerror?.();
      vi.advanceTimersByTime(2000);
      latest().open();
      latest().emit('conversation.updated', ready);
    });
    expect(onResync).toHaveBeenCalled();
  });

  it('resumes polling after returning from the background at the stream cap', () => {
    const onResync = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync }));
    act(() => latest().emit('conversation.updated', { payload: { error: 'too_many_streams' } }));
    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);
    });
    expect(onResync).not.toHaveBeenCalled();
    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    onResync.mockClear();
    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS));
    expect(onResync).toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('does not open a stream while the page starts hidden', () => {
    visibility = 'hidden';
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('reports offline and retries after a hard failure', () => {
    const onStateChange = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn(), onStateChange }));
    act(() => latest().open());

    act(() => latest().fail());
    expect(onStateChange).toHaveBeenCalledWith('offline');

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(FakeEventSource.instances.length).toBeGreaterThan(1);
  });

  it('falls back to polling once reconnects keep failing', () => {
    const onResync = vi.fn();
    const onStateChange = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync, onStateChange }));

    for (let i = 0; i < FAILURES_BEFORE_POLLING; i++) {
      act(() => latest().fail());
      act(() => {
        vi.advanceTimersByTime(40_000);
      });
    }

    expect(onStateChange).toHaveBeenCalledWith('polling');

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS + 100);
    });
    expect(onResync).toHaveBeenCalled();
  });

  it('gives up and polls when the server says too many streams are open', () => {
    const onStateChange = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn(), onStateChange }));
    act(() => latest().open());
    const stream = latest();

    act(() =>
      stream.emit('conversation.updated', {
        type: 'conversation.updated',
        conversationId: '',
        at: 1,
        payload: { error: 'too_many_streams' }
      })
    );

    // Retrying would just take a connection slot from the tab the user is
    // actually looking at.
    expect(stream.closed).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith('polling');
  });

  it('carries the last event id so the server can backfill', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    act(() => latest().open());
    act(() =>
      latest().emit('message.created', { type: 'message.created', conversationId: 'c1', at: 5, payload: {} }, '5')
    );

    act(() => latest().fail());
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(latest().url).toContain('lastEventId=5');
  });

  it('resyncs after a reconnect, in case the replay window was missed', () => {
    const onResync = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync }));
    act(() => latest().open());

    act(() => latest().fail());
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    act(() => latest().open());
    act(() => latest().emit('conversation.updated', ready));

    expect(onResync).toHaveBeenCalled();
  });
});

describe('going to the background', () => {
  it('closes immediately when hidden before mobile timers can be frozen', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    act(() => latest().open());
    const stream = latest();

    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(stream.closed).toBe(true);
  });

  it('rebuilds the connection even after a brief switch away', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    act(() => latest().open());
    const stream = latest();

    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(2_000);
    });
    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(stream.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('reconnects and refetches on return', () => {
    const onResync = vi.fn();
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync }));
    act(() => latest().open());

    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const afterHidden = FakeEventSource.instances.length;
    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(FakeEventSource.instances.length).toBe(afterHidden + 1);
    // Push may have been dropped while away, so what arrived is fetched
    // rather than waited for.
    expect(onResync).toHaveBeenCalled();
  });
});

describe('coming back online', () => {
  it('reconnects when the network returns', () => {
    renderHook(() => useChatStream({ onEvent: vi.fn(), onResync: vi.fn() }));
    act(() => latest().open());
    act(() => latest().fail());

    const before = FakeEventSource.instances.length;
    act(() => window.dispatchEvent(new Event('online')));

    expect(FakeEventSource.instances.length).toBe(before + 1);
  });
});
