import { getCorrelationId, getSessionId } from '@tumbaland/components';
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

function getJwtTokenFromCookie(cookieName = 'access_token'): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  return match ? match[2] : null;
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
 */
export function createAuthService(config: AuthServiceConfig) {
  let authCache: AuthResponse | null = null;
  let authCacheTime = 0;

  function syncJwtToken(): void {
    const token = getJwtTokenFromCookie();
    if (token && localStorage.getItem('authToken') !== token) {
      localStorage.setItem('authToken', token);
    }
  }

  return {
    /** Sync the JWT from cookie to localStorage. Call once on app start. */
    init(): void {
      syncJwtToken();
    },

    getToken(): string | null {
      return localStorage.getItem('authToken');
    },

    syncToken(): void {
      syncJwtToken();
    },

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
          localStorage.removeItem('authToken');
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

    /** Decodes the local JWT directly — no network call, but can be stale. */
    getCurrentUserFromToken(): User | null {
      try {
        const token = this.getToken();
        if (!token) return null;

        const payload = token.split('.')[1];
        if (!payload) return null;

        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
          return null;
        }

        return {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.preferred_username,
          picture: decoded.picture
        };
      } catch (error) {
        console.error('Failed to decode JWT token:', error);
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
