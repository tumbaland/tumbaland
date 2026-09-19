import { createAuthService, createAppAuthService } from './authService';
import { logger } from './monitoring';

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

    it('drops session-scoped storage so the next account does not inherit this one context', async () => {
      localStorage.setItem('selectedTenant', JSON.stringify({ id: 'g1', name: 'Group A', type: 'group' }));
      const authService = createAuthService(config);

      mockFetchOnce({ success: true });
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: vi.fn() } });

      await authService.logout();
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });

      expect(localStorage.getItem('selectedTenant')).toBeNull();
    });

    it('tells the shell its session ended when signing out inside the shell iframe', async () => {
      const parentPostMessage = vi.fn();
      const originalParent = window.parent;
      Object.defineProperty(window, 'parent', {
        writable: true,
        configurable: true,
        value: { postMessage: parentPostMessage }
      });
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: vi.fn() } });

      mockFetchOnce({ success: true });
      await createAuthService(config).logout();

      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
      Object.defineProperty(window, 'parent', { writable: true, configurable: true, value: originalParent });

      // Without this the shell keeps its own cached "authenticated" for up to
      // five minutes and still renders the signed-in home page.
      expect(parentPostMessage).toHaveBeenCalledWith({ source: 'tumbaland-app', type: 'app:logout' }, '*');
    });

    it('does not post a logout message when not framed', async () => {
      const postMessageSpy = vi.spyOn(window, 'postMessage');
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: vi.fn() } });

      mockFetchOnce({ success: true });
      await createAuthService(config).logout();

      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });

      expect(postMessageSpy).not.toHaveBeenCalled();
      postMessageSpy.mockRestore();
    });

    it('returns false and does not clear the cache when the response is not ok', async () => {
      mockFetchOnce({ success: true, authenticated: true, user: null });
      const authService = createAuthService(config);
      await authService.checkAuth();

      mockFetchOnce({}, { ok: false, status: 500 });
      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      const result = await authService.logout();

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith('Logout failed', expect.any(Error));
      loggerErrorSpy.mockRestore();
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
      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      const profile = await authService.getProfile();

      expect(profile).toBeNull();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Profile fetch error', undefined, {
        status: 403,
        body: 'Forbidden'
      });
      loggerErrorSpy.mockRestore();
    });
  });
});

describe('createAppAuthService', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('maps AUTH_SERVICE_URL into the verify request', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, authenticated: true, user: null })
    });
    const authService = createAppAuthService(() => ({
      AUTH_SERVICE_URL: 'https://auth.example',
      AUTH_FRONT_URL: 'https://login.example'
    }));

    const authenticated = await authService.isAuthenticated();

    expect(authenticated).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://auth.example/auth/verify',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('maps AUTH_FRONT_URL into the login redirect', () => {
    const authService = createAppAuthService(() => ({
      AUTH_SERVICE_URL: 'https://auth.example',
      AUTH_FRONT_URL: 'https://login.example'
    }));
    const originalLocation = window.location;
    // jsdom throws "Not implemented: navigation" on a real href assignment —
    // replace the whole object with a plain one (as the tests above do).
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });

    authService.redirectToLogin('https://app.example/page');

    expect(window.location.href).toBe(
      'https://login.example?redirect_uri=https%3A%2F%2Fapp.example%2Fpage'
    );
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});

describe('checkAuth inside the shell', () => {
  const SHELL = 'https://shell.example';
  const config = {
    getAuthServiceUrl: () => 'https://auth.example',
    getAuthFrontUrl: () => 'https://login.example',
    getShellUrl: () => SHELL
  };
  const user = { id: '1', email: 'a@b.com', name: 'A' };

  // jsdom has no real parent window; a same-document iframe stands in for the
  // shell, so replies can carry a genuine Window as their source.
  let shellWindow: Window;
  let postToShell: ReturnType<typeof vi.fn>;
  const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');

  const lastRequest = () => {
    const [message, targetOrigin] = postToShell.mock.calls.at(-1)!;
    return { message, targetOrigin };
  };

  const shellReplies = (data: Record<string, unknown>, { origin = SHELL, source = shellWindow } = {}) =>
    window.dispatchEvent(new MessageEvent('message', { origin, source, data }));

  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    shellWindow = frame.contentWindow!;
    postToShell = vi.fn();
    shellWindow.postMessage = postToShell as unknown as Window['postMessage'];
    Object.defineProperty(window, 'parent', { configurable: true, get: () => shellWindow });
    window.history.replaceState({}, '', '/?embedded=1&embedPath=%2F');
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalParent) Object.defineProperty(window, 'parent', originalParent);
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = '';
  });

  it("uses the shell's answer instead of calling auth-service", async () => {
    const authService = createAuthService(config);

    const pending = authService.checkAuth();
    const { message, targetOrigin } = lastRequest();
    expect(message).toMatchObject({ source: 'tumbaland-app', type: 'app:auth-request' });
    expect(targetOrigin).toBe(SHELL);

    shellReplies({ source: 'tumbaland-shell', type: 'shell:auth', id: message.id, authenticated: true, user });

    await expect(pending).resolves.toEqual({ authenticated: true, user });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignores answers from anywhere but the shell', async () => {
    mockFetchOnce({ success: true, authenticated: false });
    const authService = createAuthService(config);

    const pending = authService.checkAuth();
    const { id } = lastRequest().message;
    const lie = { source: 'tumbaland-shell', type: 'shell:auth', id, authenticated: true, user };
    shellReplies(lie, { origin: 'https://evil.example' });
    shellReplies(lie, { source: window });
    shellReplies({ ...lie, id: 'another-request' });
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({ authenticated: false, user: null });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('asks auth-service itself when the shell does not answer in time', async () => {
    mockFetchOnce({ success: true, authenticated: true, user });
    const warn = vi.spyOn(logger, 'warn').mockResolvedValue(undefined);
    const authService = createAuthService(config);

    const pending = authService.checkAuth();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({ authenticated: true, user });
    expect(global.fetch).toHaveBeenCalledWith('https://auth.example/auth/verify', expect.anything());
    warn.mockRestore();
  });

  it('never asks the shell when not loaded with the embed flag', async () => {
    window.history.replaceState({}, '', '/');
    mockFetchOnce({ success: true, authenticated: true, user });
    const authService = createAuthService(config);

    await authService.checkAuth();

    expect(postToShell).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('shares one check between callers that ask at the same time', async () => {
    const authService = createAuthService(config);

    const first = authService.checkAuth();
    const second = authService.checkAuth();
    expect(postToShell).toHaveBeenCalledTimes(1);
    shellReplies({ source: 'tumbaland-shell', type: 'shell:auth', id: lastRequest().message.id, authenticated: true, user });

    expect(await first).toBe(await second);
  });

  it('does not let a check that was in flight across a cache clear refill the cache', async () => {
    const authService = createAuthService(config);

    const stale = authService.checkAuth();
    const { id } = lastRequest().message;
    authService.clearAuthCache();
    shellReplies({ source: 'tumbaland-shell', type: 'shell:auth', id, authenticated: true, user });
    await stale;

    const fresh = authService.checkAuth();
    expect(postToShell).toHaveBeenCalledTimes(2);
    shellReplies({ source: 'tumbaland-shell', type: 'shell:auth', id: lastRequest().message.id, authenticated: false, user: null });
    await expect(fresh).resolves.toEqual({ authenticated: false, user: null });
  });
});

describe('createAppAuthService', () => {
  it('passes the shell URL from config through', async () => {
    global.fetch = vi.fn();
    mockFetchOnce({ success: true, authenticated: true, user: null });
    const authService = createAppAuthService(() => ({
      AUTH_SERVICE_URL: 'https://auth.example',
      AUTH_FRONT_URL: 'https://login.example',
      SHELL_FRONT_URL: 'https://shell.example'
    }));

    // Not framed here, so the shell URL alone does not change anything.
    await expect(authService.checkAuth()).resolves.toMatchObject({ authenticated: true });
  });
});
