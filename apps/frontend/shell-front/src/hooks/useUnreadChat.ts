import { useEffect, useRef, useState } from 'react';
import { getGlobalConfig } from '../config/ConfigProvider';
import { setBadge } from '../services/pushNotifications';

/**
 * The unread count behind the Chat tab's badge, and the dot on the installed
 * app's icon.
 *
 * Polled rather than streamed. chat-front already holds one `EventSource`, and
 * the service caps a person at five: a second connection from the shell would
 * spend a fifth of that budget to learn a number that changes every few
 * minutes. The poll pauses while the tab is hidden, where push is the
 * notification path instead.
 */

const POLL_MS = 60_000;

export function useUnreadChat(enabled: boolean, route?: string): number {
  const [unread, setUnread] = useState(0);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      setBadge(0);
      return;
    }

    const { CHAT_API_URL } = getGlobalConfig();
    if (!CHAT_API_URL) return;

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const read = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch(`${CHAT_API_URL}/api/chat/unread`, { credentials: 'include' });
        if (!response.ok || !active) return;
        const json = (await response.json()) as { data?: { unread?: number } };
        if (!active) return;
        const count = json.data?.unread ?? 0;
        setUnread(count);
        setBadge(count);
      } catch {
        // A missing count is not worth surfacing: the number simply does not
        // move until the next poll succeeds.
      }
    };

    refresh.current = () => void read();

    const start = () => {
      if (timer) return;
      void read();
      timer = setInterval(() => void read(), POLL_MS);
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      refresh.current = () => {};
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  // A route change is when a count most likely moved: leaving a thread that
  // was just read. The first run is skipped; the poll above already read it.
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    refresh.current();
  }, [route]);

  return enabled ? unread : 0;
}
