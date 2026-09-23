import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { AuthHeader as SharedAuthHeader } from '@tumbaland/frontend-core';

const mockedUseTenant = vi.fn();
// Spread the real module: this file only stands in for the header and the
// tenant hook, but @tumbaland/frontend-core also carries `logger`, which the
// component calls when an auth check fails. A full replacement dropped it, and
// the resulting rejection failed the run while every test still reported green.
vi.mock('@tumbaland/frontend-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tumbaland/frontend-core')>()),
  AuthHeader: (props: ComponentProps<typeof SharedAuthHeader>) => (
    <div>
      <div data-testid="is-authenticated">{String(props.isAuthenticated)}</div>
      <div data-testid="user-email">{props.user?.email ?? 'none'}</div>
      <div data-testid="selected-tenant">
        {(typeof props.selectedTenant === 'object' ? props.selectedTenant?.name : props.selectedTenant) ?? 'none'}
      </div>
      <button onClick={props.onLogin}>login</button>
      <button onClick={props.onLogout}>logout</button>
    </div>
  ),
  TenantSelector: () => <div>tenant selector</div>,
  useTenant: (...args: unknown[]) => mockedUseTenant(...args)
}));

vi.mock('../services/authService', () => ({
  authService: { checkAuth: vi.fn(), redirectToLogin: vi.fn(), logout: vi.fn() }
}));

vi.mock('../config/ConfigProvider', () => ({
  useConfig: () => ({ GROUP_API_URL: 'https://group.example', SHELL_FRONT_URL: 'https://shell.example' })
}));

import { authService } from '../services/authService';
import AuthHeader from './AuthHeader';

const mockedCheckAuth = authService.checkAuth as unknown as ReturnType<typeof vi.fn>;
const mockedRedirectToLogin = authService.redirectToLogin as unknown as ReturnType<typeof vi.fn>;
const mockedLogout = authService.logout as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedLogout.mockResolvedValue(true);
  mockedUseTenant.mockReturnValue({
    selectedTenant: undefined,
    availableTenants: [],
    loading: false,
    error: null,
    setSelectedTenant: vi.fn()
  });
});

it('passes the authenticated user through to the shared header', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: { email: 'jane@example.com' } });
  render(<AuthHeader />);

  expect(await screen.findByTestId('is-authenticated')).toHaveTextContent('true');
  expect(screen.getByTestId('user-email')).toHaveTextContent('jane@example.com');
});

it('reports unauthenticated when the auth check fails', async () => {
  mockedCheckAuth.mockRejectedValue(new Error('down'));
  render(<AuthHeader />);

  expect(await screen.findByTestId('is-authenticated')).toHaveTextContent('false');
  expect(mockedUseTenant).toHaveBeenCalledWith('https://group.example', undefined);
});

it('passes the user id to useTenant only once authenticated with a group API url', async () => {
  // The id, not the address: an email is a mutable attribute of an account, and
  // useTenant keys each account's remembered context by whatever it is given.
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: { id: 'user-jane', email: 'jane@example.com' } });
  render(<AuthHeader />);

  await screen.findByTestId('is-authenticated');
  expect(mockedUseTenant).toHaveBeenCalledWith('https://group.example', 'user-jane');
});

it('redirects to login via authService', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
  render(<AuthHeader />);
  await screen.findByTestId('is-authenticated');

  await userEvent.click(screen.getByText('login'));
  expect(mockedRedirectToLogin).toHaveBeenCalled();
});

it('calls logout on logout', async () => {
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: { email: 'jane@example.com' } });
  render(<AuthHeader />);
  await screen.findByTestId('is-authenticated');

  await userEvent.click(screen.getByText('logout'));
  expect(mockedLogout).toHaveBeenCalled();
});
