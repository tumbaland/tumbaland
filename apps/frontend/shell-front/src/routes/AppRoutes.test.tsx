import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

const checkAuth = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: () => checkAuth(),
    redirectToLogin: vi.fn()
  }
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div>dashboard</div>
}));

import AppRoutes from './AppRoutes';

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>
  );
}

beforeEach(() => {
  checkAuth.mockReset();
});

it('shows a loader instead of the marketing copy while the session check is in flight', () => {
  checkAuth.mockReturnValue(new Promise(() => {}));
  renderRoutes();

  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
});

it('serves the landing page to signed-out visitors', async () => {
  checkAuth.mockResolvedValue({ authenticated: false, user: null });
  renderRoutes();

  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/private app for the two of you/i)
  );
  expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
});

it('serves the dashboard to signed-in users', async () => {
  checkAuth.mockResolvedValue({ authenticated: true, user: { email: 'a@b.c' } });
  renderRoutes();

  await waitFor(() => expect(screen.getByText('dashboard')).toBeInTheDocument());
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
});

it('falls back to the landing page when the session check fails', async () => {
  checkAuth.mockRejectedValue(new Error('auth-service down'));
  renderRoutes();

  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
});
