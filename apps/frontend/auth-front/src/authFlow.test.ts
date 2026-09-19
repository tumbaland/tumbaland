// This test file lives alongside authFlow.ts (both directly under src/), so
// the mock specifiers below match the exact relative paths authFlow.ts itself
// imports.
vi.mock('./config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn(() => ({ AUTH_SERVICE_URL: 'https://auth.example' }))
}));

import { initializeGoogleSignIn } from './authFlow';

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
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initializeGoogleSignIn', () => {
  it('initializes and renders the button once the Google library is available', () => {
    const { initialize, renderButton } = mockGoogle();

    initializeGoogleSignIn('client-id', '/redirect');
    vi.advanceTimersByTime(0);

    expect(initialize).toHaveBeenCalledWith({
      client_id: 'client-id',
      ux_mode: 'redirect',
      login_uri: 'https://auth.example/auth/google/callback',
      nonce: expect.stringMatching(/^[0-9a-f]{32}$/)
    });
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

  describe('redirect-mode sign-in', () => {
    let cookieWrites: string[];

    beforeEach(() => {
      cookieWrites = [];
      vi.spyOn(document, 'cookie', 'set').mockImplementation((value: string) => {
        cookieWrites.push(value);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('stores the nonce it gives Google in a cookie for the callback to check', () => {
      const { initialize } = mockGoogle();
      initializeGoogleSignIn('client-id', '/redirect-target');
      vi.advanceTimersByTime(0);

      const { nonce } = initialize.mock.calls[0][0];
      const nonceCookie = cookieWrites.find((c) => c.startsWith('login_nonce='))!;
      expect(nonceCookie).toContain(`login_nonce=${nonce}`);
      expect(nonceCookie).toContain('path=/auth/google');
      expect(nonceCookie).toContain('SameSite=None');
      expect(nonceCookie).toContain('Secure');
    });

    it('stores where to return as an absolute URL', () => {
      mockGoogle();
      initializeGoogleSignIn('client-id', '/redirect-target');
      vi.advanceTimersByTime(0);

      const redirectCookie = cookieWrites.find((c) => c.startsWith('login_redirect='))!;
      const value = decodeURIComponent(redirectCookie.split(';')[0].slice('login_redirect='.length));
      expect(value).toBe(new URL('/redirect-target', window.location.href).toString());
    });

    it('sets no cookie domain on localhost', () => {
      mockGoogle();
      initializeGoogleSignIn('client-id', '/redirect-target');
      vi.advanceTimersByTime(0);

      expect(cookieWrites.length).toBeGreaterThan(0);
      expect(cookieWrites.every((c) => !c.includes('domain='))).toBe(true);
    });
  });
});
