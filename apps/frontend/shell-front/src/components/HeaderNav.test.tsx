import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    redirectToLogin: vi.fn(),
    logout: vi.fn()
  }
}));

import { authService } from '../services/authService';
import { HeaderNav } from './HeaderNav';

const mockedCheckAuth = authService.checkAuth as unknown as ReturnType<typeof vi.fn>;
const mockedRedirectToLogin = authService.redirectToLogin as unknown as ReturnType<typeof vi.fn>;
const mockedLogout = authService.logout as unknown as ReturnType<typeof vi.fn>;

const authenticatedUser = { id: 'u1', email: 'a@b.com', name: 'A B' };

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
});

it('renders nothing outside account/groups/payments routes', () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
  const { container } = render(
    <MemoryRouter>
      <HeaderNav currentRoute="/" />
    </MemoryRouter>
  );
  expect(container).toBeEmptyDOMElement();
});

it('shows a login button when unauthenticated on an account route', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
  render(
    <MemoryRouter>
      <HeaderNav currentRoute="/account" />
    </MemoryRouter>
  );

  const loginButton = (await screen.findByTestId('LoginIcon')).closest('button')!;
  await userEvent.click(loginButton);
  expect(mockedRedirectToLogin).toHaveBeenCalled();
});

it('shows the account menu and navigation buttons when authenticated on a groups route', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: authenticatedUser });
  render(
    <MemoryRouter>
      <HeaderNav currentRoute="/groups" />
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'account menu' })).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Billing' })).toBeInTheDocument();
});

it('logs out via the account menu on a payments route', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: authenticatedUser });
  mockedLogout.mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <HeaderNav currentRoute="/payments" />
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'account menu' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'account menu' }));
  await userEvent.click(screen.getByText('Logout'));

  expect(mockedLogout).toHaveBeenCalled();
});

it('logs the error and falls back to unauthenticated when the auth check fails', async () => {
  mockedCheckAuth.mockRejectedValue(new Error('boom'));
  render(
    <MemoryRouter>
      <HeaderNav currentRoute="/account" />
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.queryByRole('button', { name: 'account menu' })).not.toBeInTheDocument());
});

it('renders the compact mobile layout when on a small screen', async () => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: authenticatedUser });

  render(
    <MemoryRouter>
      <HeaderNav currentRoute="/account" />
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'account menu' })).toBeInTheDocument());
});
