import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedUseTenant = vi.fn();
vi.mock('@tumbaland/components', () => ({
  AuthHeader: (props: any) => (
    <div>
      <div data-testid="is-authenticated">{String(props.isAuthenticated)}</div>
      <div data-testid="user-email">{props.user?.email ?? 'none'}</div>
      <div data-testid="selected-tenant">{props.selectedTenant ?? 'none'}</div>
      <button onClick={props.onLogin}>login</button>
      <button onClick={props.onLogout}>logout</button>
    </div>
  ),
  TenantSelector: () => <div>tenant selector</div>,
  useTenant: (...args: unknown[]) => mockedUseTenant(...args)
}));

vi.mock('../services/authService', () => ({
  authService: { redirectToLogin: vi.fn() }
}));

vi.mock('../config/ConfigProvider', () => ({
  useConfig: () => ({ GROUP_API_URL: 'https://group.example', SHELL_FRONT_URL: 'https://shell.example' })
}));

const mockedMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: vi.fn(),
  useLogout: () => ({ mutateAsync: mockedMutateAsync })
}));

import { authService } from '../services/authService';
import { useCurrentUser } from '../hooks/useAuth';
import AuthHeader from './AuthHeader';

const mockedUseCurrentUser = useCurrentUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedMutateAsync.mockResolvedValue(undefined);
  mockedUseTenant.mockReturnValue({
    selectedTenant: undefined,
    availableTenants: [],
    loading: false,
    error: null,
    setSelectedTenant: vi.fn()
  });
});

it('passes the authenticated user through to the shared header', () => {
  mockedUseCurrentUser.mockReturnValue({ data: { email: 'jane@example.com' }, isLoading: false });

  render(<AuthHeader />);

  expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
  expect(screen.getByTestId('user-email')).toHaveTextContent('jane@example.com');
});

it('reports unauthenticated when there is no user', () => {
  mockedUseCurrentUser.mockReturnValue({ data: undefined, isLoading: false });

  render(<AuthHeader />);

  expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
  // useTenant is called with an undefined user key since the user isn't authenticated
  expect(mockedUseTenant).toHaveBeenCalledWith('https://group.example', undefined);
});

it('passes the user email to useTenant only once authenticated with a group API url', () => {
  mockedUseCurrentUser.mockReturnValue({ data: { email: 'jane@example.com' }, isLoading: false });

  render(<AuthHeader />);

  expect(mockedUseTenant).toHaveBeenCalledWith('https://group.example', 'jane@example.com');
});

it('redirects to login via authService', async () => {
  mockedUseCurrentUser.mockReturnValue({ data: undefined, isLoading: false });
  render(<AuthHeader />);

  await userEvent.click(screen.getByText('login'));

  expect(authService.redirectToLogin).toHaveBeenCalled();
});

it('calls the logout mutation on logout', async () => {
  mockedUseCurrentUser.mockReturnValue({ data: { email: 'jane@example.com' }, isLoading: false });
  render(<AuthHeader />);

  await userEvent.click(screen.getByText('logout'));

  expect(mockedMutateAsync).toHaveBeenCalled();
});
