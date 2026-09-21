import { useEffect, useInsertionEffect, useRef } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi } from '../services/chatApi';
import type { ChatEvent } from '../types';

/**
 * The live connection to chat-service.
 *
 * `EventSource` with `withCredentials` sends the `.tumbaland.eu` session cookie
 * to the API's own subdomain, so there is no token handling here at all.
 *
 * Three behaviours exist because of how phones actually behave, not because the
 * protocol needs them:
 *
 * - **A heartbeat watchdog.** iOS suspends a backgrounded EventSource without
 *   firing `error` or `close`. The connection looks open and delivers nothing,
 *   forever. The server sends a comment every 25s; if two go missing the
 *   connection is treated as dead and rebuilt.
 * - **Close when hidden.** A backgrounded tab holding a stream open is what
 *   makes chat apps eat battery. While hidden, push is the notification path;
 *   the stream is reopened on return, and its `Last-Event-ID` backfills.
 * - **A polling fallback.** After repeated failures the app falls back to
 *   asking on a timer. A chat that is a few seconds late is usable; one that
 *   silently stops is not.
 */

/** Missed heartbeats before the connection is assumed dead. */
const MISSED_HEARTBEATS = 2;

/** Assumed until the server's `ready` frame says otherwise. */
const DEFAULT_HEARTBEAT_MS = 25_000;

/** Consecutive failures before giving up on SSE and polling instead. */
export const FAILURES_BEFORE_POLLING = 3;

export const POLL_INTERVAL_MS = 10_000;

/** How long a hidden tab keeps its stream before dropping it. */
const HIDDEN_GRACE_MS = 30_000;

export type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

export interface UseChatStreamOptions {
  onEvent: (event: ChatEvent) => void;
  /** Called when the transport has been away and the caller should refetch. */
  onResync: () => void;
  onStateChange?: (state: ConnectionState) => void;
  enabled?: boolean;
}

export function useChatStream({ onEvent, onResync, onStateChange, enabled = true }: UseChatStreamOptions): void {
  // Held in refs so reconnecting never depends on the caller memoising its
  // callbacks; a changed identity must not tear down a live connection.
  //
  // Written in an insertion effect rather than during render: React may render
  // a component without committing it, and a ref written on a discarded render
  // would leave a callback from a tree that was thrown away.
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  const onStateRef = useRef(onStateChange);

  useInsertionEffect(() => {
    onEventRef.current = onEvent;
    onResyncRef.current = onResync;
    onStateRef.current = onStateChange;
  });

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatMs = DEFAULT_HEARTBEAT_MS;
    let failures = 0;
    let lastEventId = '';
    let stopped = false;
    /**
     * Whether this connection replaces one that dropped.
     *
     * Recorded when the connection is opened rather than read off `failures`,
     * because `onopen` clears that counter and fires *before* the server's
     * `ready` frame arrives. Reading it there would mean the post-reconnect
     * refetch never ran, which is the one case it exists for.
     */
    let reconnecting = false;

    const setState = (state: ConnectionState) => onStateRef.current?.(state);

    const clearTimers = () => {
      if (watchdog) clearTimeout(watchdog);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      watchdog = null;
      reconnectTimer = null;
    };

    const closeStream = () => {
      clearTimers();
      source?.close();
      source = null;
    };

    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        // No heartbeat and no message for two intervals. The browser still
        // believes this connection is fine, so nothing else will notice.
        logger.warn('Chat stream went quiet; reconnecting');
        closeStream();
        scheduleReconnect();
      }, heartbeatMs * MISSED_HEARTBEATS);
    };

    const startPolling = () => {
      if (pollTimer) return;
      setState('polling');
      pollTimer = setInterval(() => onResyncRef.current(), POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const scheduleReconnect = () => {
      if (stopped || document.visibilityState === 'hidden') return;

      failures++;
      if (failures >= FAILURES_BEFORE_POLLING) startPolling();

      // Capped exponential backoff, so a service that is down is not hammered
      // by every open tab.
      const delay = Math.min(1000 * 2 ** Math.min(failures, 5), 30_000);
      reconnectTimer = setTimeout(connect, delay);
    };

    function connect(): void {
      if (stopped || source) return;

      reconnecting = failures > 0;
      setState('connecting');

      // The last id is passed in the query string as well as relied on through
      // the browser's own `Last-Event-ID` header: after an explicit close the
      // browser starts a fresh connection and sends no header at all, which is
      // exactly the reconnect that most needs the backfill.
      const url = new URL(chatApi.streamUrl());
      if (lastEventId) url.searchParams.set('lastEventId', lastEventId);

      const stream = new EventSource(url.toString(), { withCredentials: true });
      source = stream;

      stream.onopen = () => {
        failures = 0;
        stopPolling();
        setState('live');
        armWatchdog();
      };

      // A comment (the heartbeat) fires no event, but any traffic resets the
      // browser's internal state; the watchdog is re-armed on every message,
      // and the server's frames are frequent enough to serve as the signal.
      stream.onmessage = () => armWatchdog();

      stream.onerror = () => {
        // EventSource reconnects by itself, but only for a transport error. A
        // 401 or a 429 closes it for good, and this is the only notice.
        if (stream.readyState === EventSource.CLOSED) {
          closeStream();
          setState('offline');
          scheduleReconnect();
        }
      };

      const handle = (event: MessageEvent) => {
        armWatchdog();
        if (event.lastEventId) lastEventId = event.lastEventId;

        let parsed: ChatEvent;
        try {
          parsed = JSON.parse(event.data) as ChatEvent;
        } catch {
          logger.warn('Unreadable chat event', { data: event.data });
          return;
        }

        // The server's opening frame says how often to expect a heartbeat, so
        // the watchdog matches the server rather than guessing.
        const payload = parsed.payload as { ready?: boolean; heartbeatMs?: number; error?: string } | null;
        if (parsed.type === 'conversation.updated' && payload?.ready) {
          if (payload.heartbeatMs) heartbeatMs = payload.heartbeatMs;
          armWatchdog();
          // A reconnect may have missed events beyond the server's replay
          // window, so the caller refetches rather than trusting the backfill.
          if (reconnecting) {
            reconnecting = false;
            onResyncRef.current();
          }
          return;
        }
        if (payload?.error === 'too_many_streams') {
          // Another tab holds the connections. Polling is the honest fallback:
          // retrying would just take a slot from the tab the user is looking at.
          logger.warn('Too many chat streams open; falling back to polling');
          closeStream();
          startPolling();
          stopped = true;
          return;
        }

        onEventRef.current(parsed);
      };

      for (const type of [
        'message.created',
        'message.updated',
        'message.deleted',
        'reaction.updated',
        'conversation.updated',
        'typing',
        'read'
      ]) {
        stream.addEventListener(type, handle as EventListener);
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // A grace period, so switching apps for a moment does not cost a
        // reconnect on the way back.
        hiddenTimer = setTimeout(() => {
          closeStream();
          stopPolling();
        }, HIDDEN_GRACE_MS);
        return;
      }

      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = null;
      if (!source && !stopped) {
        failures = 0;
        connect();
        // Whatever arrived while the app was away is fetched rather than
        // waited for: push may have been dropped, and the replay window is
        // five minutes.
        onResyncRef.current();
      }
    };

    const onOnline = () => {
      if (!source && !stopped) {
        failures = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    connect();

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      stopPolling();
      closeStream();
    };
  }, [enabled]);
}
