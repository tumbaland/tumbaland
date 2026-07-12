import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    redirectToLogin: vi.fn()
  }
}));

import { authService } from '../services/authService';
import ProtectedRoute from './ProtectedRoute';

const mockedCheckAuth = authService.checkAuth as unknown as ReturnType<typeof vi.fn>;
const mockedRedirectToLogin = authService.redirectToLogin as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a loader while the auth check is in flight', () => {
  mockedCheckAuth.mockReturnValue(new Promise(() => {}));
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>);
  expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
});

it('renders children once authenticated', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: true });
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>);
  expect(await screen.findByText('secret')).toBeInTheDocument();
});

it('shows the unauthorized page when not authenticated', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: false });
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>);
  expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
});

it('treats a failed auth check as unauthenticated', async () => {
  mockedCheckAuth.mockRejectedValue(new Error('network down'));
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>);
  expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
});

it('redirects to login when the unauthorized page requests it', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: false });
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>);
  const loginButton = await screen.findByRole('button', { name: /log ?in|sign ?in/i });
  loginButton.click();
  await waitFor(() => expect(mockedRedirectToLogin).toHaveBeenCalled());
});
