import { useEffect, useRef } from 'react';
import { moduleOf, recordOpen, recordVisit } from '../services/activity';

/** How long the app has to have been out of sight before coming back counts as a new visit. */
export const AWAY_MS = 30 * 60 * 1000;

/**
 * Reports visits and page opens while someone is signed in.
 *
 *  - A visit when the app loads, and again when a tab comes back into view
 *    after at least half an hour away. A tab left open overnight is one visit
 *    the next morning, not a thousand and not none.
 *  - An open each time the address moves to a different page of the app. The
 *    pages inside a module (`/album/albums`, `/album/collages`) are one open of
 *    Album, so wandering inside a module does not inflate it.
 *
 * Nothing is sent while signed out.
 */
export function useActivity(authenticated: boolean, pathname: string): void {
  useEffect(() => {
    if (!authenticated) return;

    recordVisit();

    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MS) recordVisit();
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [authenticated]);

  // The page being looked at, by module: `null` for the shell's documents.
  const module = moduleOf(pathname);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!authenticated || module === null) {
      // Not a page of the app: nothing to count, and the next module opened
      // counts as an open even if it is the one left a moment ago.
      last.current = null;
      return;
    }
    if (module === last.current) return;
    last.current = module;
    recordOpen(pathname);
  }, [authenticated, module, pathname]);
}
