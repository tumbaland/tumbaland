/**
 * Where this app lives in the URL, in both the modes it runs in.
 *
 * Under module federation the shell owns the one router and mounts this app's
 * routes at `/admin/*`; standalone, `App.tsx` mounts the same routes at the
 * same prefix. Keeping the prefix identical in both is what lets a single
 * absolute address work in either (see account-front's appBase for why
 * relative navigation does not).
 */
export const APP_BASE = '/admin';

/** An address inside this app, as both routers read it. */
export const appPath = (path: string): string => `${APP_BASE}${path}`;
