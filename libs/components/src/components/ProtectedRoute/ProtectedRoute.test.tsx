import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
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
