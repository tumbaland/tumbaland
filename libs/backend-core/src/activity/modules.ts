/**
 * The pages whose opening is counted, named by the route segment shell-front
 * mounts them at (`/relationship` is the Journal, `/finance` is Money).
 *
 * The route, not the display name, because routes are what stay put: the
 * Journal has been called "relationship" in every URL and service since before
 * it was renamed, and a counter keyed by a label would split in two the day a
 * label changed. The admin screens translate these back to names.
 *
 * A fixed list rather than any string a client sends, so a bug or a hostile
 * browser cannot grow a day's document one invented key at a time.
 */
export const ACTIVITY_MODULES = [
  'home',
  'relationship',
  'album',
  'finance',
  'chat',
  'account',
  'groups',
  'payments',
  'admin'
] as const;

export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

/** Where the app was running: a browser tab, an installed PWA, or a native wrapper (see shell-front's platform.ts). */
export const ACTIVITY_PLATFORMS = ['web', 'pwa', 'ios', 'android'] as const;

export type ActivityPlatform = (typeof ACTIVITY_PLATFORMS)[number];

export const isActivityModule = (value: unknown): value is ActivityModule =>
  typeof value === 'string' && (ACTIVITY_MODULES as readonly string[]).includes(value);
