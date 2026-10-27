import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@tumbaland/frontend-core';

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  /** A sentence to show, or null. */
  error: string | null;
  reload: () => void;
}

/** What to tell an administrator when a request failed. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    // The role checks' own refusals ('admin required' from backend-core,
    // 'Forbidden' from auth-service's requireRole) say nothing to a person; any
    // other 403 (closing your own account) carries a sentence worth showing.
    if (error.status === 403 && (error.message === 'admin required' || error.message === 'Forbidden')) {
      return 'This area is for administrators.';
    }
    if (error.status === 404) return 'That does not exist.';
    return error.message;
  }
  return 'Could not reach the server.';
}

/**
 * Loads something when the page opens, and again when `deps` change or `reload`
 * is called. The previous result stays on screen while the next one loads, so a
 * change of sort or page does not blank the table.
 *
 * A late answer to a request that has since been replaced is dropped, so
 * clicking through quickly cannot leave the screen showing the wrong page.
 */
export function useLoad<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    load()
      .then((result) => {
        if (!current) return;
        setData(result);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (current) setError(describeError(failure));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
    // `load` is a closure over `deps`; listing it would reload on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, loading, error, reload };
}
