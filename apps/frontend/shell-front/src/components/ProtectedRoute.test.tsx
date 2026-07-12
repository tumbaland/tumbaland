import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/authService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    redirectToLogin: vi.fn()
  }
}));

import { authService } from '../services/authService';
import { ProtectedRoute } from './ProtectedRoute';

const mockedIsAuthenticated = authService.isAuthenticated as unknown as ReturnType<typeof vi.fn>;
const mockedRedirectToLogin = authService.redirectToLogin as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a loader while checking auth', () => {
  mockedIsAuthenticated.mockReturnValue(new Promise(() => {}));
  render(
    <ProtectedRoute>
      <div>secret</div>
    </ProtectedRoute>
  );
  expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
});

it('renders children when authenticated', async () => {
  mockedIsAuthenticated.mockResolvedValue(true);
  render(
    <ProtectedRoute>
      <div>secret</div>
    </ProtectedRoute>
  );
  expect(await screen.findByText('secret')).toBeInTheDocument();
});

it('shows the unauthorized page and redirects to login when not authenticated', async () => {
  mockedIsAuthenticated.mockResolvedValue(false);
  render(
    <ProtectedRoute>
      <div>secret</div>
    </ProtectedRoute>
  );

  await userEvent.click(await screen.findByRole('button', { name: /sign in to continue/i }));
  expect(mockedRedirectToLogin).toHaveBeenCalled();
});

it('treats a failed auth check as unauthenticated', async () => {
  mockedIsAuthenticated.mockRejectedValue(new Error('boom'));
  render(
    <ProtectedRoute>
      <div>secret</div>
    </ProtectedRoute>
  );
  expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
});
