import { useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { authService } from '../services/authService';
import { User } from '../types';

export interface AuthState {
  loading: boolean;
  authenticated: boolean;
  user: User | null;
}

/**
 * Reads session state for the shell's own routes. `checkAuth` caches for five
 * minutes inside the auth service, so Layout and the `/` route share one
 * result rather than each issuing a request.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, authenticated: false, user: null });

  useEffect(() => {
    let active = true;

    authService
      .checkAuth()
      .then(({ authenticated, user }) => {
        if (active) setState({ loading: false, authenticated, user: user ?? null });
      })
      .catch((error) => {
        logger.error('Auth check failed', error);
        if (active) setState({ loading: false, authenticated: false, user: null });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export default useAuthState;
