import { useEffect, useState } from 'react';
import type { User } from '@tumbaland/frontend-core';
import { authService } from '../services/authService';

export interface UseCurrentUserResult {
  user: User | null;
  loading: boolean;
}

/**
 * Who is signed in.
 *
 * The thread needs this before it can render: which side a bubble sits on, and
 * whose typing and read events to ignore, both hang off the caller's user id.
 * `checkAuth` caches for five minutes and shares concurrent calls, so asking
 * here costs nothing on top of what `ProtectedRoute` already asked.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    authService
      .checkAuth()
      .then((response) => {
        if (!active) return;
        setUser(response.authenticated ? (response.user ?? null) : null);
      })
      .catch(() => {
        // ProtectedRoute owns the redirect; this hook only reports.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}
