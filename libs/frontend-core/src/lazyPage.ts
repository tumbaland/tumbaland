import { lazy, type ComponentType } from 'react';

const RELOADED_AT_KEY = 'tumbaland.pageReloadedAt';

/** A second failure this soon after reloading is a real outage, not a stale page. */
const RELOAD_WINDOW_MS = 60_000;

/**
 * `React.lazy` for a route's page, safe across a deploy.
 *
 * The shell keeps an app's code loaded for the whole visit, and a deploy
 * replaces the page chunks it would load next with new ones under new names.
 * Opening a page not visited yet then asks for a file that is gone, and
 * `lazy` caches that failure, so no retry helps. The page is older than the
 * server: one reload fetches the new build. If it fails again within a minute,
 * the error is shown instead of reloading in a loop.
 */
export function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (error) {
      let reloadedAt: number;
      try {
        reloadedAt = Number(window.sessionStorage.getItem(RELOADED_AT_KEY)) || 0;
      } catch {
        // Storage blocked: without a record, reloading could loop, so show the error.
        throw error;
      }
      if (Date.now() - reloadedAt < RELOAD_WINDOW_MS) throw error;
      try {
        window.sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
      } catch {
        throw error;
      }
      window.location.reload();
      // Never settles: the page is going away.
      return new Promise<never>(() => {});
    }
  });
}
