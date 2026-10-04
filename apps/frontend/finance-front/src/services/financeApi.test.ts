import { vi } from 'vite-plus/test';

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => ({ FINANCE_API_URL: 'http://localhost:4003', AUTH_FRONT_URL: 'http://localhost:3004' })
}));

import { financeApi } from './financeApi';

function mock401() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'unauthorized' }),
    text: async () => ''
  }) as unknown as typeof fetch;
}

it('redirects to the auth front on a 401 response', async () => {
  mock401();
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: 'https://app.example/dashboard' }
  });

  await expect(financeApi.get('/holdings')).rejects.toThrow();

  expect(window.location.href).toContain('redirect_uri=');
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});
