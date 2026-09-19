import { RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { extractChildPath, joinShellPath, normalizeEmbedPath, safeUrl, toOrigin } from './embedContext';
import {
  SHELL_SOURCE,
  ShellAuthMessage,
  ShellNavigateMessage,
  isAppAuthRequestMessage,
  isAppLocationMessage,
  isAppLogoutMessage,
  isNavigateTopMessage
} from './messages';

export interface ShellBridgeOptions {
  frameRef: RefObject<HTMLIFrameElement | null>;
  /** Shell route prefix owned by the app, e.g. `/album`. */
  appRoute?: string;
  /** App URL from config, e.g. `https://album.tumbaland.eu`. */
  appUrl?: string;
  /** Current shell location, used to detect shell-initiated navigation. */
  shellPath: string;
  shellSearch?: string;
  /** Mirror a child location into the shell URL. */
  onNavigate: (shellPath: string, options: { replace: boolean }) => void;
  /** Reflect the child's page title into the browser tab. */
  onTitleChange?: (title: string) => void;
  /** The framed app signed the user out; the shell's own session is over too. */
  onChildLogout?: () => void;
  /**
   * The shell's own auth state, answered to a framed app's `app:auth-request`
   * so the app need not call /auth/verify itself. Without it the request goes
   * unanswered and the app asks auth-service after a short wait.
   */
  onAuthRequest?: () => Promise<{ authenticated: boolean; user: unknown }>;
}

/**
 * Shell half of the iframe URL bridge.
 *
 * Listens for location reports from the framed app and mirrors them into the
 * shell's own router, and pushes shell-initiated navigation (back/forward, a
 * pasted deep link) down into the frame. Answers the frame's auth checks from
 * the shell's own, so a page open verifies the session once. Also handles the legacy
 * `tumbaland:navigate-top` escape hatch from payment-front's checkout.
 */
export const useShellBridge = ({
  frameRef,
  appRoute,
  appUrl,
  shellPath,
  shellSearch = '',
  onNavigate,
  onTitleChange,
  onChildLogout,
  onAuthRequest
}: ShellBridgeOptions): void => {
  const appOrigin = useMemo(() => toOrigin(appUrl), [appUrl]);
  // Path the child just reported, so we don't push it straight back down.
  const lastFromApp = useRef<string | null>(null);
  // The child's first report is its own default-route redirect: replace rather
  // than push, so back from /album/dashboard doesn't land on bare /album.
  const pendingFirstSync = useRef(true);

  const handleAppLocation = useCallback(
    (path: string, title?: string) => {
      if (!appRoute) return;
      const normalized = normalizeEmbedPath(path);
      lastFromApp.current = normalized;
      onNavigate(joinShellPath(appRoute, normalized), { replace: pendingFirstSync.current });
      pendingFirstSync.current = false;
      if (title) onTitleChange?.(title);
    },
    [appRoute, onNavigate, onTitleChange]
  );

  useEffect(() => {
    pendingFirstSync.current = true;
    lastFromApp.current = null;
  }, [appRoute, appOrigin]);

  useEffect(() => {
    if (!appOrigin || !appRoute) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== appOrigin) return;
      // Only trust our own frame, not some other window on the same origin.
      const frame = frameRef.current;
      if (frame?.contentWindow && event.source !== frame.contentWindow) return;

      if (isAppLocationMessage(event.data)) {
        handleAppLocation(event.data.path, event.data.title);
        return;
      }

      if (isAppLogoutMessage(event.data)) {
        onChildLogout?.();
        return;
      }

      if (isAppAuthRequestMessage(event.data)) {
        if (!onAuthRequest || !frame?.contentWindow) return;
        const { id } = event.data;
        const target = frame.contentWindow;
        onAuthRequest().then(({ authenticated, user }) => {
          const answer: ShellAuthMessage = { source: SHELL_SOURCE, type: 'shell:auth', id, authenticated, user };
          target.postMessage(answer, appOrigin);
        });
        return;
      }

      if (isNavigateTopMessage(event.data)) {
        const target = safeUrl(event.data.url);
        if (!target) return;
        // A URL inside the framed app is a shell route in disguise; anything
        // else genuinely wants to leave the shell.
        if (target.origin === appOrigin) {
          handleAppLocation(`${target.pathname}${target.search}`);
        } else {
          window.location.assign(target.href);
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [appOrigin, appRoute, frameRef, handleAppLocation, onChildLogout, onAuthRequest]);

  useEffect(() => {
    if (!appOrigin || !appRoute) return;

    const childPath = extractChildPath(appRoute, shellPath, shellSearch);
    if (lastFromApp.current === childPath) {
      lastFromApp.current = null;
      return;
    }

    // Before the frame loads, the initial path is already in its src.
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;

    const message: ShellNavigateMessage = {
      source: SHELL_SOURCE,
      type: 'shell:navigate',
      path: childPath
    };
    frame.contentWindow.postMessage(message, appOrigin);
  }, [appOrigin, appRoute, frameRef, shellPath, shellSearch]);
};
