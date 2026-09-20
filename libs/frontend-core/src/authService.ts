import { getCorrelationId, getSessionId, logger } from './monitoring';
import { clearSessionScopedStorage } from './sessionStorage';
import { AuthResponse, User } from './types';

export interface AuthServiceConfig {
  /** Read fresh at call time (config may not be resolved yet at module load). */
  getAuthServiceUrl: () => string;
  getAuthFrontUrl: () => string;
  /** The shell's URL. When the app runs inside it, the shell answers auth checks. */
  getShellUrl?: () => string | undefined;
}

const AUTH_CACHE_TTL = 5 * 60 * 1000;

/** How long an embedded app waits for the shell before asking auth-service itself. */
const SHELL_AUTH_TIMEOUT_MS = 3000;

/**
 * The shell's origin, when this app runs inside it: framed, and loaded with the
 * `embedded=1` flag the shell puts in the iframe src (see buildEmbeddedUrl in
 * @tumbaland/frontend-core). A direct visit is never embedded.
 */
function embeddingShellOrigin(shellUrl: string | undefined): string | null {
  if (typeof window === 'undefined' || window.parent === window.self || !shellUrl) return null;
  if (new URLSearchParams(window.location.search).get('embedded') !== '1') return null;
  try {
    return new URL(shellUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Asks the shell for its auth state instead of calling /auth/verify.
 *
 * The shell has already checked the session when it framed this app, and
 * every app calling verify on its own meant several parallel renewals on each
 * page open. Resolves to null when the shell does not answer in time (an older
 * shell, or a slow one), and the caller then asks auth-service itself.
 *
 * The answer only decides what the app shows. Every API call still carries the
 * session cookie and is checked by the service it goes to.
 *
 * Contract lives in @tumbaland/frontend-core `routing/messages` (app:auth-request
 * and shell:auth); a lower layer cannot import it, so the literals are repeated.
 */
function askShellForAuth(shellOrigin: string): Promise<AuthResponse | null> {
  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const finish = (result: AuthResponse | null) => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== shellOrigin || event.source !== window.parent) return;
      const data = event.data as {
        source?: unknown;
        type?: unknown;
        id?: unknown;
        authenticated?: unknown;
        user?: unknown;
      };
      if (!data || data.source !== 'tumbaland-shell' || data.type !== 'shell:auth' || data.id !== id) return;
      finish({ authenticated: data.authenticated === true, user: (data.user as User | null) ?? null });
    };

    const timer = window.setTimeout(() => {
      logger.warn('Shell did not answer the auth check; asking auth-service instead');
      finish(null);
    }, SHELL_AUTH_TIMEOUT_MS);

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ source: 'tumbaland-app', type: 'app:auth-request', id }, shellOrigin);
  });
}

/**
 * Tell the shell its session just ended.
 *
 * Each app runs in the shell's iframe with its own copy of this module, so a
 * logout inside the frame clears only the frame's cache and reloads only the
 * frame. The shell keeps serving its own five-minute-old `authenticated:
 * true` from memory, which is why signing out and clicking home still showed
 * the signed-in page instead of the landing page.
 *
 * The message carries nothing, so `'*'` gives nothing away; the shell is the
 * side that authenticates it, by origin and by frame (see `useShellBridge`).
 */
function notifyShellOfLogout(): void {
  if (typeof window === 'undefined' || window.parent === window.self) return;
  try {
    // Contract lives in @tumbaland/frontend-core `routing/messages` — a lower
    // layer cannot import it, so the literal is repeated here.
    window.parent.postMessage({ source: 'tumbaland-app', type: 'app:logout' }, '*');
  } catch (error) {
    logger.warn('Failed to notify shell of logout', { error });
  }
}

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
  let pendingCheck: Promise<AuthResponse> | null = null;
  // Bumped by clearAuthCache, so a check already in flight (say, across a
  // logout) cannot put its stale answer back into the cache.
  let cacheGeneration = 0;

  /** Inside the shell, the shell's answer; otherwise (or if it does not answer) auth-service's. */
  const resolveAuth = async (): Promise<AuthResponse> => {
    const generation = cacheGeneration;
    const remember = (result: AuthResponse): AuthResponse => {
      if (generation === cacheGeneration) {
        authCache = result;
        authCacheTime = Date.now();
      }
      return result;
    };

    const shellOrigin = embeddingShellOrigin(config.getShellUrl?.());
    if (shellOrigin) {
      const fromShell = await askShellForAuth(shellOrigin);
      if (fromShell) return remember(fromShell);
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
      return remember({
        authenticated: data.success && data.authenticated,
        user: data.user || null
      });
    } catch (error) {
      logger.error('Auth check failed', error);
      return remember({ authenticated: false, user: null });
    }
  };

  return {
    clearAuthCache(): void {
      authCache = null;
      authCacheTime = 0;
      pendingCheck = null;
      cacheGeneration += 1;
    },

    /** Verifies the session against auth-service. Cached for 5 minutes. */
    async checkAuth(): Promise<AuthResponse> {
      const now = Date.now();
      if (authCache && now - authCacheTime < AUTH_CACHE_TTL) {
        return authCache;
      }
      // Callers that ask at the same time share one check.
      if (!pendingCheck) {
        pendingCheck = resolveAuth().finally(() => {
          pendingCheck = null;
        });
      }
      return pendingCheck;
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
          this.clearAuthCache();
          clearSessionScopedStorage();
          notifyShellOfLogout();
          window.location.reload();
        }
        return data.success;
      } catch (error) {
        logger.error('Logout failed', error);
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
          logger.error('Profile fetch error', undefined, { status: response.status, body: errorText });
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.success ? data.user : null;
      } catch (error) {
        logger.error('Get profile failed', error);
        return null;
      }
    },

    async isAuthenticated(): Promise<boolean> {
      const result = await this.checkAuth();
      return result.authenticated;
    },

    /**
     * The cached answer, without a round trip, or null when there is none.
     *
     * For the one caller that has to decide what to paint *before* it can
     * await anything: a gate that starts every mount in a "checking" state
     * flashes a spinner even when the answer has been sitting in memory for
     * seconds. Callers that can wait use `checkAuth`, which this never
     * replaces — it only answers "do we already know?".
     */
    getCachedAuth(): AuthResponse | null {
      if (authCache && Date.now() - authCacheTime < AUTH_CACHE_TTL) {
        return authCache;
      }
      return null;
    }
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** The auth-related keys every front's resolved config exposes. */
export interface AppAuthConfig {
  AUTH_SERVICE_URL?: string;
  AUTH_FRONT_URL?: string;
  SHELL_FRONT_URL?: string;
}

/**
 * Convenience over `createAuthService` for the frontends, which all read the
 * same auth URLs (and the shell's) from their resolved config. Centralizes that key mapping
 * so each app's `services/authService.ts` is just:
 *
 *   export const authService = createAppAuthService(getGlobalConfig);
 *
 * instead of repeating the `AUTH_SERVICE_URL` / `AUTH_FRONT_URL` wiring.
 */
export function createAppAuthService(getGlobalConfig: () => AppAuthConfig): AuthService {
  return createAuthService({
    getAuthServiceUrl: () => getGlobalConfig().AUTH_SERVICE_URL!,
    getAuthFrontUrl: () => getGlobalConfig().AUTH_FRONT_URL!,
    getShellUrl: () => getGlobalConfig().SHELL_FRONT_URL
  });
}
