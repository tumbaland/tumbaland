import { useEffect, useState, ReactNode } from 'react';
import { logger, type AuthService } from '@tumbaland/frontend-core';
import { Loader } from '../Loader';
import { UnauthorizedPage } from '../UnauthorizedPage';

/** The subset of a per-app auth service that ProtectedRoute depends on. */
export type ProtectedRouteAuthService = Pick<AuthService, 'isAuthenticated' | 'redirectToLogin'>;

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
 * Consolidated from seven per-front copies that had drifted into two
 * behaviourally different variants (one polling `checkAuth`, one
 * `isAuthenticated`, with different initial/loading semantics).
 */
export function ProtectedRoute({
  children,
  authService,
  loadingMessage = 'Checking authentication...'
}: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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
