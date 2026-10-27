import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { useConfig } from '../config/ConfigProvider';
import { initializeGoogleSignIn } from '../authFlow';
import { authApi } from '../services/authApi';

vi.mock('../config/ConfigProvider', () => ({ useConfig: vi.fn() }));
vi.mock('../authFlow', () => ({ initializeGoogleSignIn: vi.fn() }));
vi.mock('../services/authApi', () => ({ authApi: { get: vi.fn(), post: vi.fn() } }));

const mockedUseConfig = useConfig as unknown as ReturnType<typeof vi.fn>;
const mockedInitGoogle = initializeGoogleSignIn as unknown as ReturnType<typeof vi.fn>;
const mockedGet = authApi.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = authApi.post as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseConfig.mockReturnValue({ GOOGLE_CLIENT_ID: 'test-client-id', AUTH_SERVICE_URL: 'https://auth.example' });
  mockedGet.mockRejectedValue(new Error('not authenticated'));
});

describe('LoginPage — unauthenticated flow', () => {
  it('shows the login prompt and starts Google Sign-In when no existing session and GOOGLE_CLIENT_ID is set', async () => {
    render(<LoginPage />);

    await waitFor(() => expect(mockedInitGoogle).toHaveBeenCalledWith('test-client-id', '/'));
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a config error and never calls initializeGoogleSignIn when GOOGLE_CLIENT_ID is unset', async () => {
    mockedUseConfig.mockReturnValue({ AUTH_SERVICE_URL: 'https://auth.example' });

    render(<LoginPage />);

    expect((await screen.findAllByText(/google client id is not configured/i)).length).toBeGreaterThan(0);
    expect(mockedInitGoogle).not.toHaveBeenCalled();
  });

  it('shows an initialization error when initializeGoogleSignIn throws synchronously', async () => {
    mockedInitGoogle.mockImplementation(() => {
      throw new Error('boom');
    });

    render(<LoginPage />);

    expect((await screen.findAllByText(/failed to initialize google sign-in: boom/i)).length).toBeGreaterThan(0);
  });

  it('says sign-in did not go through when the callback sent the person back with an error', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '?error=signin_failed&redirect_uri=%2F' }
    });

    render(<LoginPage />);

    expect((await screen.findAllByText(/sign-in did not go through/i)).length).toBeGreaterThan(0);
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('tells a person whose account was closed so, rather than asking them to try again', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '?error=account_closed&redirect_uri=%2F' }
    });

    render(<LoginPage />);

    expect((await screen.findAllByText(/This account was closed at your request/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/sign-in did not go through/i)).not.toBeInTheDocument();
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('uses the redirect_uri query param when starting Google Sign-In', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '?redirect_uri=%2Falbums' }
    });

    render(<LoginPage />);

    await waitFor(() => expect(mockedInitGoogle).toHaveBeenCalledWith('test-client-id', '/albums'));
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});

describe('LoginPage — checkExistingAuth edge cases', () => {
  it('falls through to the login prompt when the session response is success but not authenticated', async () => {
    mockedGet.mockResolvedValue({ success: true, authenticated: false });

    render(<LoginPage />);

    await waitFor(() => expect(mockedInitGoogle).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('LoginPage — authenticated flow (logout / continue)', () => {
  const authedUser = { name: 'Ada Lovelace', email: 'ada@example.com' };

  beforeEach(() => {
    mockedGet.mockResolvedValue({ success: true, authenticated: true, user: authedUser });
  });

  it('logs out, clears the user, and reloads the page on success', async () => {
    mockedPost.mockResolvedValue({ success: true });
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: reloadSpy } });
    const user = userEvent.setup();

    render(<LoginPage />);
    await screen.findByText(/welcome back, ada lovelace/i);

    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/auth/logout'));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('does not reload and does not throw when the logout request fails', async () => {
    mockedPost.mockRejectedValue(new Error('network down'));
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, reload: reloadSpy } });
    const user = userEvent.setup();

    render(<LoginPage />);
    await screen.findByText(/welcome back, ada lovelace/i);

    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/auth/logout'));
    expect(reloadSpy).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('navigates to "/" when Continue is clicked with no redirect_uri query param', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, search: '', href: '' } });
    const user = userEvent.setup();

    render(<LoginPage />);
    await screen.findByText(/welcome back, ada lovelace/i);

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(window.location.href).toBe('/');
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('navigates to the redirect_uri when Continue is clicked', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '?redirect_uri=%2Falbums', href: '' }
    });
    const user = userEvent.setup();

    render(<LoginPage />);
    await screen.findByText(/welcome back, ada lovelace/i);

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(window.location.href).toBe('/albums');
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});
