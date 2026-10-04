import { vi } from 'vite-plus/test';

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn()
}));

import { getGlobalConfig } from '../config/ConfigProvider';
import { albumApi } from './albumApi';

const mockedGetGlobalConfig = getGlobalConfig as unknown as ReturnType<typeof vi.fn>;

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  } as Response);
}

beforeEach(() => {
  global.fetch = vi.fn();
  mockedGetGlobalConfig.mockReturnValue({
    ALBUM_API_URL: 'https://album.example',
    AUTH_FRONT_URL: 'https://login.example'
  });
});

it('resolves its base URL from ALBUM_API_URL', async () => {
  mockFetchOnce({ success: true });

  await albumApi.get('/albums');

  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toBe('https://album.example/api/albums');
});

it('redirects to AUTH_FRONT_URL with a redirect_uri on a 401', async () => {
  mockFetchOnce({ message: 'no' }, { ok: false, status: 401 });
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: 'https://album.example/albums/42' }
  });

  await expect(albumApi.get('/albums/42')).rejects.toThrow();

  expect(window.location.href).toBe(
    'https://login.example?redirect_uri=' + encodeURIComponent('https://album.example/albums/42')
  );
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});
