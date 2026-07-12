import { vi } from 'vitest';
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
  Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'https://app.example/dashboard' } });

  await expect(financeApi.get('/holdings')).rejects.toThrow();

  expect(window.location.href).toContain('redirect_uri=');
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});
