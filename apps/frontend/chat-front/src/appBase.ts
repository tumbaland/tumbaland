/**
 * Where this app lives in the URL, in both the modes it runs in.
 *
 * Under module federation the shell owns the one router and mounts this app's
 * routes at `/chat/*`; standalone, `App.tsx` mounts the same routes at the same
 * prefix. Keeping the prefix identical in both is what lets a single absolute
 * address work in either, which matters more here than elsewhere: a push
 * notification opens `/chat/<conversationId>` from a cold start, and that
 * address has to mean the same thing however the app was loaded.
 */
export const APP_BASE = '/chat';

/** An address inside this app, as both routers read it. */
export const appPath = (path: string): string => `${APP_BASE}${path}`;
