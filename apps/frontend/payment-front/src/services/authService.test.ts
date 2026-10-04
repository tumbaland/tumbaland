import { vi } from 'vite-plus/test';
import { authService } from './authService';

beforeEach(() => authService.clearAuthCache());

it('checks auth against the configured auth service url', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ success: true, authenticated: true, user: { email: 'u@example.com' } })
  } as Response);

  const result = await authService.isAuthenticated();

  expect(result).toBe(true);
  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/auth/verify');
});

it('redirects to the configured auth front url', () => {
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: 'https://app.example/plans' }
  });

  authService.redirectToLogin();

  expect(window.location.href).toContain('redirect_uri=');
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
});
