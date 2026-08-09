/**
 * Message contract between the shell and an embedded child app.
 *
 * The shell owns the browser URL; embedded children run on a MemoryRouter and
 * never touch browser history themselves. These messages keep the two in sync:
 * the child reports where it navigated, the shell tells the child where to go
 * when the user edits the URL or hits back/forward.
 */

export const SHELL_SOURCE = 'tumbaland-shell';
export const APP_SOURCE = 'tumbaland-app';

/** Shell -> child: adopt this path (user hit back/forward or pasted a URL). */
export interface ShellNavigateMessage {
  source: typeof SHELL_SOURCE;
  type: 'shell:navigate';
  path: string;
}

/** Child -> shell: I navigated here, please mirror it into the address bar. */
export interface AppLocationMessage {
  source: typeof APP_SOURCE;
  type: 'app:location';
  app: string;
  path: string;
  title?: string;
}

/**
 * Child -> shell: the user signed out in here, the cookie is gone.
 *
 * The shell cannot see this on its own — the frame reloads itself, the shell
 * does not, and its cached auth check keeps it looking signed in for up to
 * five minutes. Sent by `logout()` in @tumbaland/frontend-core, which cannot
 * import this module (components depends on frontend-core, not the reverse),
 * so the literals there must match these.
 */
export interface AppLogoutMessage {
  source: typeof APP_SOURCE;
  type: 'app:logout';
}

/**
 * Child -> shell: escape hatch for flows that must leave the frame (payment
 * checkout redirects). Predates this contract, so it carries its own `source`.
 */
export interface NavigateTopMessage {
  source: string;
  type: 'tumbaland:navigate-top';
  url: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isShellNavigateMessage = (value: unknown): value is ShellNavigateMessage =>
  isRecord(value) &&
  value.source === SHELL_SOURCE &&
  value.type === 'shell:navigate' &&
  typeof value.path === 'string';

export const isAppLocationMessage = (value: unknown): value is AppLocationMessage =>
  isRecord(value) &&
  value.source === APP_SOURCE &&
  value.type === 'app:location' &&
  typeof value.app === 'string' &&
  typeof value.path === 'string';

export const isAppLogoutMessage = (value: unknown): value is AppLogoutMessage =>
  isRecord(value) && value.source === APP_SOURCE && value.type === 'app:logout';

export const isNavigateTopMessage = (value: unknown): value is NavigateTopMessage =>
  isRecord(value) && value.type === 'tumbaland:navigate-top' && typeof value.url === 'string';
