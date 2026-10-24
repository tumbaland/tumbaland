import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';

export interface AsyncData<T> {
  /** The last result that arrived; undefined until the first one does. */
  data: T | undefined;
  loading: boolean;
  error: string | null;
  /** Fetch again with the same inputs. */
  reload: () => void;
}

/**
 * Runs `load` when `deps` change and on `reload()`, and keeps only the answer
 * to the latest request.
 *
 * A chart that fetches in a bare effect lets a slow answer for last year land
 * after the fast answer for this year, and show last year's numbers under this
 * year's heading. Here a request that was superseded, or whose component has
 * gone, is ignored when it finally arrives.
 *
 * `load` is read at the moment the effect runs, so it may use the render's
 * props and state without being listed; `deps` says what should trigger a fetch.
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  failure = 'Failed to load data'
): AsyncData<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    latest
      .current()
      .then((result) => {
        if (current) setData(result);
      })
      .catch((err: unknown) => {
        if (!current) return;
        logger.error('Error fetching data', err);
        setError(err instanceof Error ? err.message : failure);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
    // `deps` is the caller's list; `failure` is a constant in practice.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, round]);

  const reload = useCallback(() => setRound((value) => value + 1), []);

  return { data, loading, error, reload };
}
