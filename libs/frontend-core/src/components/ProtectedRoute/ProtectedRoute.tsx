import { useEffect, useState, ReactNode } from 'react';
import { type AuthService } from '../../authService';
import { logger } from '../../monitoring';
import { Loader } from '../Loader';
import { UnauthorizedPage } from '../UnauthorizedPage';

/** The subset of a per-app auth service that ProtectedRoute depends on. */
export type ProtectedRouteAuthService = Pick<AuthService, 'isAuthenticated' | 'redirectToLogin'> &
  Partial<Pick<AuthService, 'getCachedAuth'>>;

export interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * The app's auth service (from `createAuthService`). Injected per app since
   * each front wires the shared factory to its own config.
   */
  authService: ProtectedRouteAuthService;
  /** Message shown while the auth check is in flight. */
  loadingMessage?: string;
}

/**
 * Gates its children behind an authenticated session: renders a Loader while
 * the check is in flight, UnauthorizedPage (whose login action calls the auth
 * service's redirectToLogin) when unauthenticated or the check fails, and the
 * children once authenticated.
 *
 * The first state comes from the auth service's cache when it has one, so a
 * remount does not flash "Checking authentication..." over an answer already
 * held in memory. The shell mounts and unmounts this every time the user
 * crosses between its own pages and a framed module — which, on a phone, is
 * every other tap on the tab bar — and each of those was a spinner for an
 * answer that never changed. The check below still runs either way; the cache
 * only decides what is painted while it does.
 *
 * Consolidated from seven per-front copies that had drifted into two
 * behaviourally different variants (one polling `checkAuth`, one
 * `isAuthenticated`, with different initial/loading semantics).
 */
export function ProtectedRoute({
  children,
  authService,
  loadingMessage = 'Checking authentication...'
}: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    () => authService.getCachedAuth?.()?.authenticated ?? null
  );

  useEffect(() => {
    let active = true;

    authService
      .isAuthenticated()
      .then((authenticated) => {
        if (active) setIsAuthenticated(authenticated);
      })
      .catch((error) => {
        logger.error('Auth check failed', error);
        if (active) setIsAuthenticated(false);
      });

    return () => {
      active = false;
    };
  }, [authService]);

  if (isAuthenticated === null) {
    return <Loader message={loadingMessage} />;
  }

  if (!isAuthenticated) {
    return <UnauthorizedPage onLogin={() => authService.redirectToLogin()} />;
  }

  return <>{children}</>;
}
