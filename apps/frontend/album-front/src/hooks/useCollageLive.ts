import { useEffect, useInsertionEffect, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { collageService } from '../services/collageService';
import type { ServerChange } from '../components/collage/collageChanges';
import type { MovingItem } from './useCollageMotion';

/** Someone with the collage open, as the server reports them. */
export interface CollageViewer {
  session: string;
  userId: string;
  name: string;
  picture: string | null;
  selection: string | null;
}

export interface UseCollageLiveOptions {
  collageId?: string;
  session: string;
  enabled?: boolean;
  /** Someone else saved changes. */
  onChanges: (revision: number, changes: ServerChange[], by: { userId: string; name: string }) => void;
  /** Who is here now, this tab included. */
  onPresence: (viewers: CollageViewer[]) => void;
  /**
   * The server's revision: when the stream opens, and after someone saved the
   * collage whole. The caller fetches if it is behind.
   */
  onRevision: (revision: number) => void;
  /** Where someone's item is mid-drag; `item: null` once they let go. */
  onMoving?: (event: { userId: string; name: string; item: MovingItem | null }) => void;
  /**
   * The collage's albums may have new photos: one was sent in the chat, say,
   * or the stream reopened and may have missed that.
   */
  onPhotos?: () => void;
}

/** Missed heartbeats before the connection is assumed dead. */
const MISSED_HEARTBEATS = 2;
const DEFAULT_HEARTBEAT_MS = 25_000;

/**
 * The live connection for one open collage.
 *
 * The same approach as chat's stream, smaller: EventSource with the session
 * cookie, a watchdog for a connection that has gone quiet without saying so,
 * and reconnecting with backoff. It closes while the tab is hidden, since
 * nobody is editing then, and reopens on return. Every (re)open starts with
 * the server's revision, which is how anything missed meanwhile is noticed.
 */
export function useCollageLive({
  collageId,
  session,
  enabled = true,
  onChanges,
  onPresence,
  onRevision,
  onMoving,
  onPhotos
}: UseCollageLiveOptions): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onChangesRef = useRef(onChanges);
  const onPresenceRef = useRef(onPresence);
  const onRevisionRef = useRef(onRevision);
  const onMovingRef = useRef(onMoving);
  const onPhotosRef = useRef(onPhotos);

  useInsertionEffect(() => {
    onChangesRef.current = onChanges;
    onPresenceRef.current = onPresence;
    onRevisionRef.current = onRevision;
    onMovingRef.current = onMoving;
    onPhotosRef.current = onPhotos;
  });

  useEffect(() => {
    if (!enabled || !collageId || typeof EventSource === 'undefined') return;

    let source: EventSource | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatMs = DEFAULT_HEARTBEAT_MS;
    let failures = 0;
    let stopped = false;

    const hidden = () => document.visibilityState === 'hidden';

    const close = () => {
      if (watchdog) clearTimeout(watchdog);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      watchdog = null;
      reconnectTimer = null;
      source?.close();
      source = null;
      setConnected(false);
    };

    const reconnectLater = () => {
      if (stopped || hidden()) return;
      failures += 1;
      const delay = Math.min(1000 * 2 ** Math.min(failures, 5), 30_000);
      reconnectTimer = setTimeout(connect, delay);
    };

    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        logger.warn('Collage stream went quiet; reconnecting');
        close();
        reconnectLater();
      }, heartbeatMs * MISSED_HEARTBEATS);
    };

    const read = <T>(event: MessageEvent): T | null => {
      try {
        return JSON.parse(event.data) as T;
      } catch {
        logger.warn('Unreadable collage event', { data: event.data });
        return null;
      }
    };

    function connect(): void {
      if (stopped || source || hidden()) return;
      const stream = new EventSource(collageService.liveUrl(collageId!, session), { withCredentials: true });
      source = stream;
      armWatchdog();

      const current = () => source === stream && !stopped;

      stream.addEventListener('ready', (event) => {
        if (!current()) return;
        const data = read<{ heartbeatMs?: number; revision?: number; error?: string }>(event as MessageEvent);
        if (data?.error) {
          // The collage has too many tabs open. Saving still works without
          // the stream; retrying would only take a slot from someone else.
          logger.warn('Collage stream refused', { error: data.error });
          stopped = true;
          close();
          return;
        }
        failures = 0;
        setConnected(true);
        if (data?.heartbeatMs) heartbeatMs = data.heartbeatMs;
        armWatchdog();
        if (typeof data?.revision === 'number') onRevisionRef.current(data.revision);
        // Even the first connection can miss photos added after the initial
        // fetch but before the stream joined. Photos have no revision to compare.
        onPhotosRef.current?.();
      });
      stream.addEventListener('heartbeat', () => {
        if (current()) armWatchdog();
      });
      stream.addEventListener('changes', (event) => {
        if (!current()) return;
        armWatchdog();
        const data = read<{ revision: number; changes: ServerChange[]; by: { userId: string; name: string } }>(
          event as MessageEvent
        );
        if (data) onChangesRef.current(data.revision, data.changes, data.by);
      });
      stream.addEventListener('presence', (event) => {
        if (!current()) return;
        armWatchdog();
        const data = read<{ viewers: CollageViewer[] }>(event as MessageEvent);
        if (data) onPresenceRef.current(data.viewers);
      });
      stream.addEventListener('moving', (event) => {
        if (!current()) return;
        armWatchdog();
        const data = read<{ userId: string; name: string; item: MovingItem | null }>(event as MessageEvent);
        if (data) onMovingRef.current?.(data);
      });
      stream.addEventListener('photos', () => {
        if (!current()) return;
        armWatchdog();
        onPhotosRef.current?.();
      });
      stream.addEventListener('reload', (event) => {
        if (!current()) return;
        armWatchdog();
        const data = read<{ revision?: number }>(event as MessageEvent);
        onRevisionRef.current(typeof data?.revision === 'number' ? data.revision : Number.MAX_SAFE_INTEGER);
      });
      stream.onerror = () => {
        if (!current()) return;
        // Own every reconnect: the browser's own retry would skip the
        // revision check that catches what was missed.
        close();
        reconnectLater();
      };
    }

    const onVisibility = () => {
      if (hidden()) {
        close();
        onPresenceRef.current([]);
      } else if (!source && !stopped) {
        failures = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    connect();

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      close();
    };
  }, [collageId, session, enabled]);

  return { connected };
}
