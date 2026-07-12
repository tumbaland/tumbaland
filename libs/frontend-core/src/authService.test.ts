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
    global.fetch = vi.fn();
  });

  const config = {
    getAuthServiceUrl: () => 'https://auth.example',
    getAuthFrontUrl: () => 'https://login.example'
  };

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
      Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });

      authService.redirectToLogin('https://app.example/page');

      expect(window.location.href).toBe('https://login.example?redirect_uri=https%3A%2F%2Fapp.example%2Fpage');
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
    });

    it('falls back to window.location.href when no returnUrl is given', () => {
      const authService = createAuthService(config);
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: 'https://app.example/current-page' }
      });

      authService.redirectToLogin();

      expect(window.location.href).toBe(
        'https://login.example?redirect_uri=https%3A%2F%2Fapp.example%2Fcurrent-page'
      );
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
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
    it('clears the auth cache and reloads on success', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: null });
      const authService = createAuthService(config);
      await authService.checkAuth();

      mockFetchOnce({ success: true });
      // jsdom's location.reload isn't configurable — swap the whole object.
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: vi.fn() } });

      const result = await authService.logout();
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });

      expect(result).toBe(true);

      mockFetchOnce({ success: true, authenticated: false, user: null });
      const afterLogout = await authService.checkAuth();
      expect(afterLogout.authenticated).toBe(false);
    });

    it('returns false and does not clear the cache when the response is not ok', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: null });
      const authService = createAuthService(config);
      await authService.checkAuth();

      mockFetchOnce({}, { ok: false, status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await authService.logout();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('does not reload or clear the cache when the API reports success:false', async () => {
      const authService = createAuthService(config);
      mockFetchOnce({ success: false });
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: vi.fn() } });

      const result = await authService.logout();
      const reloadCalled = (window.location.reload as ReturnType<typeof vi.fn>).mock.calls.length > 0;
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });

      expect(result).toBe(false);
      expect(reloadCalled).toBe(false);
    });
  });

  describe('getProfile', () => {
    it('returns the full profile on success', async () => {
      mockFetchOnce({ success: true, user: { id: '1', email: 'a@b.com', firstName: 'A' } });
      const authService = createAuthService(config);

      const profile = await authService.getProfile();

      expect(profile).toEqual({ id: '1', email: 'a@b.com', firstName: 'A' });
    });

    it('returns null when the API reports success:false', async () => {
      mockFetchOnce({ success: false });
      const authService = createAuthService(config);

      const profile = await authService.getProfile();

      expect(profile).toBeNull();
    });

    it('returns null and logs when the response is not ok', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      });
      const authService = createAuthService(config);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const profile = await authService.getProfile();

      expect(profile).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Profile fetch error:', 403, 'Forbidden');
      consoleErrorSpy.mockRestore();
    });
  });
});
