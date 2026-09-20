/**
 * Where this app lives in the URL, in both the modes it runs in.
 *
 * Under module federation the shell owns the one router and mounts this app's
 * routes at `/account/*`; standalone, `App.tsx` mounts the same routes at the
 * same prefix. Keeping the prefix identical in both is what lets a single
 * absolute address work in either — the alternative, relative navigation,
 * resolves against the *matched route* rather than the app root, so the same
 * call means different things from different pages.
 */
export const APP_BASE = '/account';

/** An address inside this app, as both routers read it. */
export const appPath = (path: string): string => `${APP_BASE}${path}`;
