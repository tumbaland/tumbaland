import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, MemoryRouter, useLocation, useNavigate } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import { normalizeEmbedPath, readEmbedContext, toOrigin } from './embedContext';
import { APP_SOURCE, AppLocationMessage, isShellNavigateMessage } from './messages';

export interface EmbeddedRouterProps {
  /** App identifier reported to the shell, e.g. `album-front`. */
  appName: string;
  /** Shell URL from config (SHELL_FRONT_URL). Without it, no sync happens. */
  shellUrl?: string;
  children: ReactNode;
}

interface ShellLocationSyncProps {
  appName: string;
  shellOrigin?: string;
}

/**
 * Lives inside the MemoryRouter and mirrors its location up to the shell.
 *
 * Renders nothing — it exists purely for the two effects.
 */
function ShellLocationSync({ appName, shellOrigin }: ShellLocationSyncProps) {
  const location = useLocation();
  const navigate = useNavigate();
  // Path the shell just pushed onto us, so we don't echo it straight back.
  const lastFromShell = useRef<string | null>(null);

  useEffect(() => {
    if (!shellOrigin) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== shellOrigin) return;
      if (!isShellNavigateMessage(event.data)) return;

      const path = normalizeEmbedPath(event.data.path);
      lastFromShell.current = path;
      navigate(path);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate, shellOrigin]);

  useEffect(() => {
    if (!shellOrigin) {
      logger.warn('Embedded app has no shell URL configured; URL sync is disabled', { appName });
      return;
    }

    const path = `${location.pathname}${location.search}`;
    if (lastFromShell.current === path) {
      lastFromShell.current = null;
      return;
    }

    const message: AppLocationMessage = {
      source: APP_SOURCE,
      type: 'app:location',
      app: appName,
      path,
      title: document.title
    };
    window.parent.postMessage(message, shellOrigin);
  }, [appName, location.pathname, location.search, shellOrigin]);

  return null;
}

/**
 * Router for an app that can run either standalone or inside the shell.
 *
 * Standalone it is an ordinary BrowserRouter with real URLs. Embedded it
 * switches to a MemoryRouter seeded from the iframe `src`, so the child creates
 * no browser history entries at all and the shell stays the single owner of the
 * address bar and the back button.
 *
 * The app's own <Routes> table is unchanged in both modes.
 */
export function EmbeddedRouter({ appName, shellUrl, children }: EmbeddedRouterProps) {
  // Read once: the src query params describe the initial mount, not live state.
  const context = useMemo(() => readEmbedContext(), []);
  const shellOrigin = useMemo(() => toOrigin(shellUrl), [shellUrl]);

  if (!context.embedded) {
    return <BrowserRouter>{children}</BrowserRouter>;
  }

  return (
    <MemoryRouter initialEntries={[context.initialPath]}>
      <ShellLocationSync appName={appName} shellOrigin={shellOrigin} />
      {children}
    </MemoryRouter>
  );
}
