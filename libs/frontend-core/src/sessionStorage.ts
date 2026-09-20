import { logger } from './monitoring';

/**
 * Browser storage that belongs to the signed-in session rather than to the
 * browser.
 *
 * localStorage is scoped per origin, so anything written here outlives a
 * sign-out and is handed to whoever signs in next. For preferences that is
 * fine — for anything the backend authorizes against, it is a bug: the
 * incoming account sends the previous account's context and gets 403s it
 * cannot explain, from a UI that looks correctly configured.
 *
 * `logout()` clears every key listed here. Add a key to this list rather than
 * clearing it at the call site, so a new front or a second logout button
 * cannot miss it.
 */

/** Tenant (personal vs group) context — owned by `useTenant` in @tumbaland/frontend-core. */
export const TENANT_STORAGE_KEY = 'selectedTenant';

const SESSION_SCOPED_KEYS = [TENANT_STORAGE_KEY];

export function clearSessionScopedStorage(): void {
  for (const key of SESSION_SCOPED_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      logger.warn('Failed to clear session-scoped storage', { key, error: err });
    }
  }
}
