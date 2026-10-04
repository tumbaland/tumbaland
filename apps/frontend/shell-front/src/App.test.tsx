import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vite-plus/test';
import App from './App';
import { ConfigProvider } from './config/ConfigProvider';
import { authService } from './services/authService';

/**
 * `/` branches on session state (see routes/AppRoutes.tsx), so these tests have
 * to say which visitor they are: `/auth/verify` returning `authenticated` is
 * what separates the dashboard from the public landing page.
 */
function mockFetch({ authenticated }: { authenticated: boolean }) {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const href = typeof input === 'string' ? input : input.toString();
    if (href.includes('/api/todo/random')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ todo: 'Write more tests' }),
        text: async () => ''
      } as Response;
    }
    if (href.includes('/auth/verify')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, authenticated, user: authenticated ? { email: 'a@b.c' } : null }),
        text: async () => ''
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '' } as Response;
  });
}

describe('App', () => {
  // checkAuth memoizes for five minutes on the module-level service instance,
  // so without this the second test reads the first one's session.
  beforeEach(() => {
    authService.clearAuthCache();
  });

  it('renders a todo fetched from the public service for a signed-in user', async () => {
    mockFetch({ authenticated: true });

    render(
      <ConfigProvider>
        <App />
      </ConfigProvider>
    );

    // The whole app boots here — config, session, home page, then the todo —
    // which is more than waitFor's default second when the suite runs in
    // parallel.
    await waitFor(
      () => {
        expect(screen.getByText('Write more tests')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(screen.queryByText(/failed to load todo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration error/i)).not.toBeInTheDocument();
  });

  it('renders the public landing page for a signed-out visitor', async () => {
    mockFetch({ authenticated: false });

    render(
      <ConfigProvider>
        <App />
      </ConfigProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/private app for the two of you/i);
      },
      { timeout: 5000 }
    );

    expect(screen.queryByText('Write more tests')).not.toBeInTheDocument();
  });
});
