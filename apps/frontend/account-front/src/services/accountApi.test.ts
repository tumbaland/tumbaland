import { vi } from 'vitest';

const mockedGetGlobalConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => mockedGetGlobalConfig()
}));

import { accountApi } from './accountApi';

function mock401() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'unauthorized' }),
    text: async () => ''
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetGlobalConfig.mockReturnValue({ AUTH_SERVICE_URL: 'https://auth.example', AUTH_FRONT_URL: 'https://login.example' });
});

it('redirects to the auth front on a 401 response when AUTH_FRONT_URL is configured', async () => {
  mock401();
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'https://app.example/account' } });

  await expect(accountApi.get('/auth/profile')).rejects.toThrow();

  expect(window.location.href).toBe(
    'https://login.example?redirect_uri=' + encodeURIComponent('https://app.example/account')
  );
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});

it('does not redirect on a 401 when AUTH_FRONT_URL is not configured', async () => {
  mockedGetGlobalConfig.mockReturnValue({ AUTH_SERVICE_URL: 'https://auth.example' });
  mock401();
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'https://app.example/account' } });

  await expect(accountApi.get('/auth/profile')).rejects.toThrow();

  expect(window.location.href).toBe('https://app.example/account');
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});
