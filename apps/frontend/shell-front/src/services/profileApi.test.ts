import { vi } from 'vite-plus/test';

const mockedGetGlobalConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => mockedGetGlobalConfig()
}));

import { profileApi } from './profileApi';

const respondWith = (body: unknown) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  }) as unknown as typeof fetch;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetGlobalConfig.mockReturnValue({ AUTH_SERVICE_URL: 'https://auth.example' });
});

describe('getShowMoney', () => {
  it('reads the profile from the auth service', async () => {
    respondWith({ success: true, user: { showMoney: true } });

    await expect(profileApi.getShowMoney()).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://auth.example/auth/profile',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('keeps Money out of the menu until it was turned on', async () => {
    respondWith({ success: true, user: { showMoney: false } });
    await expect(profileApi.getShowMoney()).resolves.toBe(false);

    respondWith({ success: true, user: {} });
    await expect(profileApi.getShowMoney()).resolves.toBe(false);
  });
});
