import { vi } from 'vitest';
import { relationshipApi } from './relationshipApi';

it('redirects to the auth front on a 401 response', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'unauthorized' })
  }) as unknown as typeof fetch;
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'https://app.example/journal' } });

  await expect(relationshipApi.get('/days')).rejects.toThrow();

  expect(window.location.href).toContain('redirect_uri=');
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});
