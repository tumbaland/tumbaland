// This test file lives alongside authFlow.ts (both directly under src/), so
// the mock specifiers below match the exact relative paths authFlow.ts itself
// imports.
vi.mock('./config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn(() => ({ AUTH_SERVICE_URL: 'https://auth.example' }))
}));
vi.mock('./services/authApi', () => ({ authApi: { post: vi.fn() } }));

import { initializeGoogleSignIn } from './authFlow';
import { authApi } from './services/authApi';

const mockedPost = authApi.post as unknown as ReturnType<typeof vi.fn>;

function mockGoogle(overrides: { initialize?: ReturnType<typeof vi.fn>; renderButton?: ReturnType<typeof vi.fn> } = {}) {
  const renderButton =
    overrides.renderButton ??
    vi.fn((el: HTMLElement) => {
      el.innerHTML = '<div role="button">Sign in with Google</div>';
    });
  const initialize = overrides.initialize ?? vi.fn();
  (window as any).google = { accounts: { id: { initialize, renderButton } } };
  return { initialize, renderButton };
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="google-signin-button"></div>';
  delete (window as any).google;
  mockedPost.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initializeGoogleSignIn', () => {
  it('initializes and renders the button once the Google library is available', () => {
    const { initialize, renderButton } = mockGoogle();

    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(0);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-id', callback: expect.any(Function) })
    );
    expect(renderButton).toHaveBeenCalled();
  });

  it('retries every 100ms while the Google library is not yet loaded, then succeeds once it appears', () => {
    // window.google stays undefined through the first couple of attempts.
    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(100);

    const { initialize } = mockGoogle();
    vi.advanceTimersByTime(100);

    expect(initialize).toHaveBeenCalled();
  });

  it('shows a fallback message after exhausting all retries when the library never loads', () => {
    initializeGoogleSignIn('client-id', '/redirect');
    // 100 retries * 100ms, plus the initial 0ms/500ms/1000ms strategy timers.
    vi.advanceTimersByTime(11000);

    const buttonElement = document.getElementById('google-signin-button')!;
    expect(buttonElement.innerHTML).toContain('Google Sign-In failed to load');
  });

  it('does not call the Google renderButton API when the button already shows Google-rendered content', () => {
    const buttonElement = document.getElementById('google-signin-button')!;
    buttonElement.innerHTML = '<div role="button">Sign in with Google</div>';
    const { renderButton } = mockGoogle();

    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(0);

    expect(renderButton).not.toHaveBeenCalled();
  });

  it('shows a fallback message when google.accounts.id.initialize throws', () => {
    mockGoogle({
      initialize: vi.fn(() => {
        throw new Error('init failed');
      })
    });

    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(0);

    const buttonElement = document.getElementById('google-signin-button')!;
    expect(buttonElement.innerHTML).toContain('Google Sign-In failed to load');
  });

  it('retries when renderButton throws, and eventually shows the fallback message', () => {
    mockGoogle({
      renderButton: vi.fn(() => {
        throw new Error('render failed');
      })
    });

    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(11000);

    const buttonElement = document.getElementById('google-signin-button')!;
    expect(buttonElement.innerHTML).toContain('Google Sign-In failed to load');
  });

  it('does not overwrite existing fallback content if the button element already has children', () => {
    const buttonElement = document.getElementById('google-signin-button')!;
    buttonElement.innerHTML = '<span>pre-existing content</span>';
    // Google never loads, forcing the fallback path.
    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(11000);

    expect(buttonElement.innerHTML).toBe('<span>pre-existing content</span>');
  });

  it('is a no-op when the #google-signin-button element is not present in the DOM', () => {
    document.body.innerHTML = '';
    mockGoogle();

    expect(() => {
      initializeGoogleSignIn('client-id', '/redirect');
      vi.advanceTimersByTime(11000);
    }).not.toThrow();
  });

  describe('the Google credential callback (handleCredentialResponse)', () => {
    function captureCallback(): (response: { credential: string }) => void {
      const initialize = vi.fn();
      mockGoogle({ initialize });
      initializeGoogleSignIn('client-id', '/redirect-target');
      vi.advanceTimersByTime(0);
      return initialize.mock.calls[0][0].callback;
    }

    it('redirects to redirectUri when the auth service validates the credential successfully', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: '' } });
      mockedPost.mockResolvedValue({ success: true });
      const callback = captureCallback();

      callback({ credential: 'google-id-token' });
      await vi.waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/auth/validate', { idToken: 'google-id-token' }));
      await vi.waitFor(() => expect(window.location.href).toBe('/redirect-target'));

      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
    });

    it('alerts the user and does not redirect when the auth service rejects the credential', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      mockedPost.mockResolvedValue({ success: false, message: 'Not approved' });
      const callback = captureCallback();

      callback({ credential: 'google-id-token' });
      await vi.waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Authentication failed: Not approved'));

      alertSpy.mockRestore();
    });

    it('alerts the user when the validate request itself fails', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      mockedPost.mockRejectedValue(new Error('network down'));
      const callback = captureCallback();

      callback({ credential: 'google-id-token' });
      await vi.waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Authentication error: network down'));

      alertSpy.mockRestore();
    });
  });
});
