import { vi } from 'vite-plus/test';

const mockedGetGlobalConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => mockedGetGlobalConfig()
}));

import { authService } from './authService';

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetGlobalConfig.mockReturnValue({
    AUTH_SERVICE_URL: 'https://auth.example',
    AUTH_FRONT_URL: 'https://login.example'
  });
  authService.clearAuthCache();
});

it('redirects to the configured auth front url', () => {
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: 'https://app.example/account' }
  });

  authService.redirectToLogin();

  expect(window.location.href).toBe(
    'https://login.example?redirect_uri=' + encodeURIComponent('https://app.example/account')
  );
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});

it('checks auth against the configured auth service url', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, authenticated: true, user: { id: 'u1' } }),
    text: async () => ''
  }) as unknown as typeof fetch;

  const result = await authService.isAuthenticated();

  expect(global.fetch).toHaveBeenCalledWith(
    'https://auth.example/auth/verify',
    expect.objectContaining({ credentials: 'include' })
  );
  expect(result).toBe(true);
});
