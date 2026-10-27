import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import { APPS, CHAT_APP, USER_APPS, isRouteActive } from '../config/apps';
import { getAppPlatform } from './platform';

/**
 * Tells auth-service that the person opened the app, or one of its pages, so the
 * administrator can see who uses what.
 *
 * Reported from here and not worked out from requests on the server, because a
 * request is not a visit: chat keeps a live connection and polls for as long as
 * a tab is open, so counting requests would make an idle tab look like constant
 * use.
 *
 * Nothing here may ever show: no spinner, no error, no retry. It is sent and
 * forgotten, and a counter that fails costs a missed count, not a broken page.
 */
const client = createApiClient({ baseUrl: () => getGlobalConfig().AUTH_SERVICE_URL ?? '' });

/** Where the app is running, as the server counts it: a native wrapper, an installed PWA, or a browser tab. */
export type ActivityPlatform = 'web' | 'pwa' | 'ios' | 'android';

export function currentPlatform(): ActivityPlatform {
  const native = getAppPlatform();
  if (native !== 'web') return native;
  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installed ? 'pwa' : 'web';
}

/**
 * The key a page is counted under: its route without the slash (`/album/albums`
 * counts as `album`, `/` as `home`). The route and not the display name,
 * because routes are what stay put: the Journal is still `/relationship`.
 *
 * Null for anything that is not one of the app's pages (the privacy policy, a
 * share link), which are not counted as a module.
 */
export function moduleOf(pathname: string): string | null {
  if (pathname === '/') return 'home';
  const app = [...APPS, CHAT_APP, ...USER_APPS].find((candidate) => candidate.route !== '/' && isRouteActive(candidate.route, pathname));
  return app ? app.route.slice(1) : null;
}

const send = (body: { kind: 'visit' } | { kind: 'open'; module: string }): void => {
  client
    .post('/auth/activity', { ...body, platform: currentPlatform() }, { keepalive: true, skipAuthRedirect: true })
    .catch(() => {
      // Deliberately silent: see above.
    });
};

/** The app was opened, or came back after a long absence. */
export const recordVisit = (): void => send({ kind: 'visit' });

/**
 * The same page is not reported twice within this long.
 *
 * auth-service's rate limit is per address and shared with the session checks
 * every app makes when it opens, and two people on one home connection share
 * it. Someone flicking between two tabs is not using the app more than someone
 * who opened one of them, so the repeats cost a request each and add nothing.
 */
export const MIN_REOPEN_MS = 10_000;

const lastOpenedAt = new Map<string, number>();

/** A page was opened. Does nothing for an address that is not one of the app's pages. */
export function recordOpen(pathname: string): void {
  const module = moduleOf(pathname);
  if (!module) return;
  const now = Date.now();
  const last = lastOpenedAt.get(module);
  if (last !== undefined && now - last < MIN_REOPEN_MS) return;
  lastOpenedAt.set(module, now);
  send({ kind: 'open', module });
}

/** Forgets what was reported, for tests. */
export const forgetOpens = (): void => lastOpenedAt.clear();
