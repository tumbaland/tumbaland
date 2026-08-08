const STORAGE_KEY = 'tumbaland:last-visited';

/**
 * Remembers which module the user was last in, so the home page can offer a way
 * straight back. Written by Layout as the shell navigates between apps; read by
 * the home page. Deliberately localStorage rather than a backend field — it is
 * a per-device convenience, not account state worth syncing.
 */
export function recordLastVisited(route: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, route);
  } catch {
    // Private-mode or disabled storage: the shortcut is optional, so skip it.
  }
}

export function getLastVisited(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
