import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vite-plus/test';
import { ProtectedRoute } from './ProtectedRoute';

const authService = {
  isAuthenticated: vi.fn(),
  redirectToLogin: vi.fn()
};

beforeEach(() => vi.clearAllMocks());

const renderRoute = () =>
  render(
    <ProtectedRoute authService={authService}>
      <div>secret</div>
    </ProtectedRoute>
  );

it('shows a loader while the auth check is in flight', () => {
  authService.isAuthenticated.mockReturnValue(new Promise(() => {}));

  renderRoute();

  expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
});

it('renders children once authenticated', async () => {
  authService.isAuthenticated.mockResolvedValue(true);

  renderRoute();

  expect(await screen.findByText('secret')).toBeInTheDocument();
});

it('shows the unauthorized page when not authenticated', async () => {
  authService.isAuthenticated.mockResolvedValue(false);

  renderRoute();

  expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
});

it('treats a failed auth check as unauthenticated', async () => {
  authService.isAuthenticated.mockRejectedValue(new Error('network down'));

  renderRoute();

  expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
});

it('redirects to login when the unauthorized page requests it', async () => {
  authService.isAuthenticated.mockResolvedValue(false);

  renderRoute();

  const loginButton = await screen.findByRole('button', { name: /log ?in|sign ?in/i });
  loginButton.click();

  await waitFor(() => expect(authService.redirectToLogin).toHaveBeenCalled());
});

it('renders a custom loading message when provided', () => {
  authService.isAuthenticated.mockReturnValue(new Promise(() => {}));

  render(
    <ProtectedRoute authService={authService} loadingMessage="Verifying session...">
      <div>secret</div>
    </ProtectedRoute>
  );

  expect(screen.getByText(/verifying session/i)).toBeInTheDocument();
});

it('paints the children straight away when the answer is already cached', () => {
  const authService = {
    isAuthenticated: vi.fn().mockReturnValue(new Promise(() => {})), // never settles
    redirectToLogin: vi.fn(),
    getCachedAuth: () => ({ authenticated: true, user: null })
  };

  render(
    <ProtectedRoute authService={authService}>
      <div>protected content</div>
    </ProtectedRoute>
  );

  // No spinner for an answer held in memory: the shell remounts this on every
  // crossing between its own pages and a framed module.
  expect(screen.queryByText(/checking authentication/i)).not.toBeInTheDocument();
  expect(screen.getByText('protected content')).toBeInTheDocument();
});

it('shows the unauthorized page straight away when the cache says signed out', () => {
  const authService = {
    isAuthenticated: vi.fn().mockReturnValue(new Promise(() => {})),
    redirectToLogin: vi.fn(),
    getCachedAuth: () => ({ authenticated: false, user: null })
  };

  render(
    <ProtectedRoute authService={authService}>
      <div>protected content</div>
    </ProtectedRoute>
  );

  expect(screen.queryByText(/checking authentication/i)).not.toBeInTheDocument();
  expect(screen.queryByText('protected content')).not.toBeInTheDocument();
});

it('still checks in the background, and follows the fresh answer over the cached one', async () => {
  const authService = {
    isAuthenticated: vi.fn().mockResolvedValue(false),
    redirectToLogin: vi.fn(),
    getCachedAuth: () => ({ authenticated: true, user: null })
  };

  render(
    <ProtectedRoute authService={authService}>
      <div>protected content</div>
    </ProtectedRoute>
  );

  // Cached answer paints first, so there is no spinner...
  expect(screen.getByText('protected content')).toBeInTheDocument();
  // ...and the real check still overrules it when the session has ended.
  await waitFor(() => expect(screen.queryByText('protected content')).not.toBeInTheDocument());
});

it('falls back to the spinner for an auth service with no cache to offer', () => {
  const authService = {
    isAuthenticated: vi.fn().mockReturnValue(new Promise(() => {})),
    redirectToLogin: vi.fn()
  };

  render(
    <ProtectedRoute authService={authService}>
      <div>protected content</div>
    </ProtectedRoute>
  );

  expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
});
