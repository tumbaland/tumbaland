import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import type { ComponentProps } from 'react';
import type { AuthHeader as SharedAuthHeader } from './AuthHeader';

const mockedUseTenant = vi.fn();

// The header itself and the tenant hook are stood in for; the logic under test
// is what this component feeds them from the auth service.
vi.mock('./AuthHeader', () => ({
  AuthHeader: (props: ComponentProps<typeof SharedAuthHeader>) => (
    <div>
      <div data-testid="is-authenticated">{String(props.isAuthenticated)}</div>
      <div data-testid="user-email">{props.user?.email ?? 'none'}</div>
      <div data-testid="shell-url">{props.shellFrontUrl ?? 'none'}</div>
      <button onClick={props.onLogin}>login</button>
      <button onClick={props.onLogout}>logout</button>
    </div>
  )
}));
vi.mock('../tenant', () => ({
  TenantSelector: () => <div>tenant selector</div>,
  useTenant: (...args: unknown[]) => mockedUseTenant(...args)
}));

import { StandaloneAuthHeader } from './StandaloneAuthHeader';

const authService = { checkAuth: vi.fn(), redirectToLogin: vi.fn(), logout: vi.fn() };

const renderHeader = () =>
  render(
    <StandaloneAuthHeader
      authService={authService}
      navigationItems={[]}
      groupApiUrl="https://group.example"
      shellFrontUrl="https://shell.example"
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  authService.logout.mockResolvedValue(true);
  mockedUseTenant.mockReturnValue({
    selectedTenant: undefined,
    availableTenants: [],
    loading: false,
    error: null,
    setSelectedTenant: vi.fn()
  });
});

it('passes the authenticated user through to the header', async () => {
  authService.checkAuth.mockResolvedValue({ authenticated: true, user: { email: 'jane@example.com' } });
  renderHeader();

  expect(await screen.findByTestId('is-authenticated')).toHaveTextContent('true');
  expect(screen.getByTestId('user-email')).toHaveTextContent('jane@example.com');
  expect(screen.getByTestId('shell-url')).toHaveTextContent('https://shell.example');
});

it('reports unauthenticated when the auth check fails', async () => {
  authService.checkAuth.mockRejectedValue(new Error('down'));
  renderHeader();

  expect(await screen.findByTestId('is-authenticated')).toHaveTextContent('false');
  expect(mockedUseTenant).toHaveBeenCalledWith('https://group.example', undefined);
});

it('passes the user id to useTenant only once authenticated with a group API url', async () => {
  // The id, not the address: an email is a mutable attribute of an account, and
  // useTenant keys each account's remembered context by whatever it is given.
  authService.checkAuth.mockResolvedValue({ authenticated: true, user: { id: 'user-jane', email: 'jane@example.com' } });
  renderHeader();

  await screen.findByTestId('is-authenticated');
  expect(mockedUseTenant).toHaveBeenCalledWith('https://group.example', 'user-jane');
});

it('does not give useTenant a user when there is no group API url', async () => {
  authService.checkAuth.mockResolvedValue({ authenticated: true, user: { id: 'user-jane', email: 'jane@example.com' } });
  render(<StandaloneAuthHeader authService={authService} navigationItems={[]} />);

  await screen.findByTestId('is-authenticated');
  expect(mockedUseTenant).toHaveBeenLastCalledWith('', undefined);
});

it('redirects to login via the auth service', async () => {
  authService.checkAuth.mockResolvedValue({ authenticated: false, user: null });
  renderHeader();
  await screen.findByTestId('is-authenticated');

  await userEvent.click(screen.getByText('login'));
  expect(authService.redirectToLogin).toHaveBeenCalled();
});

it('calls logout on logout', async () => {
  authService.checkAuth.mockResolvedValue({ authenticated: true, user: { email: 'jane@example.com' } });
  renderHeader();
  await screen.findByTestId('is-authenticated');

  await userEvent.click(screen.getByText('logout'));
  expect(authService.logout).toHaveBeenCalled();
});
