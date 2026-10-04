import { useCallback, useEffect, useState } from 'react';
import type { Entitlements } from '../../entitlementsService';

export interface UseEntitlementsResult {
  entitlements: Entitlements | null;
  loading: boolean;
  /** Set when the lookup failed. The UI should hide the meter, not show an error. */
  error: Error | null;
  reload: () => void;
}

/**
 * Loads the caller's plan, limits and live usage once per mount.
 *
 * Takes the fetcher rather than building it, because each front resolves
 * `PAYMENT_API_URL` through its own `ConfigProvider` and this library has no
 * access to any of them.
 *
 * **For the five fronts without `@tanstack/react-query`** — account, group,
 * payment, relationship and shell. album-front and finance-front already have
 * react-query and should use `useQuery` instead, which gives them caching and
 * revalidation this deliberately does not try to reimplement.
 *
 * **Failure is not surfaced as an error state by design.** A meter is
 * decoration on top of a page that works without it — if payment-service is
 * unreachable, the album dashboard should still render albums. Callers check
 * `entitlements` for null and omit the meter; nobody gets a red box because a
 * usage bar could not load.
 */
export function useEntitlements(fetcher: () => Promise<Entitlements>): UseEntitlementsResult {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    // Guards against a state update after unmount, and against a slow first
    // response overwriting a fresher one after `reload`.
    let active = true;

    setLoading(true);
    fetcher()
      .then((result) => {
        if (!active) return;
        setEntitlements(result);
        setError(null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setEntitlements(null);
        setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // `fetcher` is intentionally not a dependency: callers commonly pass an
    // inline arrow, and depending on it would refetch on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return { entitlements, loading, error, reload };
}
