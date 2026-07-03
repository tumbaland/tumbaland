import { createAuthService } from './authService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  });
}

describe('createAuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    global.fetch = vi.fn();
  });

  const config = {
    getAuthServiceUrl: () => 'https://auth.example',
    getAuthFrontUrl: () => 'https://login.example'
  };

  describe('init/syncToken', () => {
    it('syncs the JWT from cookie to localStorage', () => {
      document.cookie = 'access_token=my-jwt-token; path=/;';
      const authService = createAuthService(config);

      authService.init();

      expect(authService.getToken()).toBe('my-jwt-token');
    });

    it('does nothing when there is no cookie', () => {
      const authService = createAuthService(config);

      authService.init();

      expect(authService.getToken()).toBeNull();
    });
  });

  describe('checkAuth', () => {
    it('returns authenticated:true and caches the result', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: { id: '1', email: 'a@b.com', name: 'A' } });
      const authService = createAuthService(config);

      const first = await authService.checkAuth();
      expect(first).toEqual({ authenticated: true, user: { id: '1', email: 'a@b.com', name: 'A' } });

      // Second call should hit the cache, not fetch again.
      const second = await authService.checkAuth();
      expect(second).toBe(first);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns authenticated:false when the response is not ok', async () => {
      mockFetchOnce({}, { ok: false, status: 500 });
      const authService = createAuthService(config);

      const result = await authService.checkAuth();

      expect(result).toEqual({ authenticated: false, user: null });
    });

    it('sends credentials:include and the auth-service base URL', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: null });
      const authService = createAuthService(config);

      await authService.checkAuth();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example/auth/verify',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('bypasses the cache after clearAuthCache', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: null });
      const authService = createAuthService(config);
      await authService.checkAuth();

      authService.clearAuthCache();
      mockFetchOnce({ success: true, authenticated: false, user: null });
      const result = await authService.checkAuth();

      expect(result.authenticated).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('redirectToLogin', () => {
    it('builds the login URL with a redirect_uri', () => {
      const authService = createAuthService(config);
      const originalLocation = window.location;
      // jsdom throws "Not implemented: navigation" on a real assignment to
      // window.location.href — replace the whole object with a plain one.
      // @ts-expect-error simplified stand-in, only `href` is used
      delete window.location;
      window.location = { href: '' } as Location;

      authService.redirectToLogin('https://app.example/page');

      expect(window.location.href).toBe('https://login.example?redirect_uri=https%3A%2F%2Fapp.example%2Fpage');
      window.location = originalLocation;
    });
  });

  describe('getCurrentUserFromToken', () => {
    it('decodes a valid, non-expired JWT from localStorage', () => {
      const payload = { sub: '1', email: 'a@b.com', name: 'A', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;
      localStorage.setItem('authToken', token);
      const authService = createAuthService(config);

      const user = authService.getCurrentUserFromToken();

      expect(user).toEqual({ id: '1', email: 'a@b.com', name: 'A', picture: undefined });
    });

    it('returns null for an expired token', () => {
      const payload = { sub: '1', email: 'a@b.com', name: 'A', exp: Math.floor(Date.now() / 1000) - 3600 };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;
      localStorage.setItem('authToken', token);
      const authService = createAuthService(config);

      expect(authService.getCurrentUserFromToken()).toBeNull();
    });

    it('returns null when there is no token', () => {
      const authService = createAuthService(config);
      expect(authService.getCurrentUserFromToken()).toBeNull();
    });
  });

  describe('isAuthenticated / getCurrentUser', () => {
    it('derive from checkAuth', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: { id: '1', email: 'a@b.com', name: 'A' } });
      const authService = createAuthService(config);

      expect(await authService.isAuthenticated()).toBe(true);
      expect(await authService.getCurrentUser()).toEqual({ id: '1', email: 'a@b.com', name: 'A' });
    });
  });

  describe('logout', () => {
    it('clears the token and cache on success', async () => {
      localStorage.setItem('authToken', 'stale-token');
      mockFetchOnce({ success: true, authenticated: true, user: null });
      const authService = createAuthService(config);
      await authService.checkAuth();

      mockFetchOnce({ success: true });
      // jsdom's location.reload isn't configurable — swap the whole object.
      const originalLocation = window.location;
      // @ts-expect-error simplified stand-in, only `reload` is used
      delete window.location;
      window.location = { ...originalLocation, reload: vi.fn() } as unknown as Location;

      const result = await authService.logout();
      window.location = originalLocation;

      expect(result).toBe(true);
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });
});
