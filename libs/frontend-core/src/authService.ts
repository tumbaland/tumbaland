import { getCorrelationId, getSessionId } from './monitoring';
import { AuthResponse, User } from './types';

export interface AuthServiceConfig {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  getAuthServiceUrl: () => string;
  getAuthFrontUrl: () => string;
}

const AUTH_CACHE_TTL = 5 * 60 * 1000;

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-correlation-id': getCorrelationId(),
    'x-session-id': getSessionId()
  };
}

/**
 * Builds a per-front auth service instance. Each of the 7 frontends that
 * previously hand-rolled their own (six divergent copies, per
 * TECHNICAL_REVIEW.md P1.3) now just wire this up with their own config
 * accessor:
 *
 *   export const authService = createAuthService({
 *     getAuthServiceUrl: () => getGlobalConfig().AUTH_SERVICE_URL!,
 *     getAuthFrontUrl: () => getGlobalConfig().AUTH_FRONT_URL!
 *   });
 *
 * The JWT lives only in an httpOnly `access_token` cookie — it is never
 * readable from JS (no localStorage mirror, no client-side decode). Every
 * call here that needs the session sends `credentials: 'include'` so the
 * browser attaches the cookie automatically; auth state is always read via
 * the network (checkAuth/getCurrentUser), never decoded locally.
 */
export function createAuthService(config: AuthServiceConfig) {
  let authCache: AuthResponse | null = null;
  let authCacheTime = 0;

  return {
    clearAuthCache(): void {
      authCache = null;
      authCacheTime = 0;
    },

    /** Verifies the session against auth-service. Cached for 5 minutes. */
    async checkAuth(): Promise<AuthResponse> {
      const now = Date.now();
      if (authCache && now - authCacheTime < AUTH_CACHE_TTL) {
        return authCache;
      }

      try {
        const response = await fetch(`${config.getAuthServiceUrl()}/auth/verify`, {
          credentials: 'include',
          headers: authHeaders()
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const result: AuthResponse = {
          authenticated: data.success && data.authenticated,
          user: data.user || null
        };
        authCache = result;
        authCacheTime = now;
        return result;
      } catch (error) {
        console.error('Auth check failed:', error);
        const result: AuthResponse = { authenticated: false, user: null };
        authCache = result;
        authCacheTime = now;
        return result;
      }
    },

    redirectToLogin(returnUrl?: string): void {
      const currentUrl = returnUrl || window.location.href;
      window.location.href = `${config.getAuthFrontUrl()}?redirect_uri=${encodeURIComponent(currentUrl)}`;
    },

    async logout(): Promise<boolean> {
      try {
        const response = await fetch(`${config.getAuthServiceUrl()}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders()
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          authCache = null;
          authCacheTime = 0;
          window.location.reload();
        }
        return data.success;
      } catch (error) {
        console.error('Logout failed:', error);
        return false;
      }
    },

    async getCurrentUser(): Promise<User | null> {
      const result = await this.checkAuth();
      return result.user;
    },

    /** Full profile (e.g. firstName/lastName) — only auth-service's /auth/profile has this. */
    async getProfile(): Promise<User | null> {
      try {
        const response = await fetch(`${config.getAuthServiceUrl()}/auth/profile`, {
          credentials: 'include',
          headers: authHeaders()
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Profile fetch error:', response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.success ? data.user : null;
      } catch (error) {
        console.error('Get profile failed:', error);
        return null;
      }
    },

    async isAuthenticated(): Promise<boolean> {
      const result = await this.checkAuth();
      return result.authenticated;
    }
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
