import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mockedGetGlobalConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => mockedGetGlobalConfig()
}));

import { currentPlatform, forgetOpens, MIN_REOPEN_MS, moduleOf, recordOpen, recordVisit } from './activity';

const respondOk = () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined }) as unknown as typeof fetch;
};

const standalone = (value: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: value && query === '(display-mode: standalone)' })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  vi.clearAllMocks();
  forgetOpens();
  mockedGetGlobalConfig.mockReturnValue({ AUTH_SERVICE_URL: 'https://auth.example' });
  standalone(false);
  respondOk();
});

afterEach(() => {
  delete window.Capacitor;
  Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
});

describe('moduleOf', () => {
  it.each([
    ['/', 'home'],
    ['/album', 'album'],
    ['/album/albums/64f2/photos/abc', 'album'],
    ['/relationship/journal', 'relationship'],
    ['/finance/net-worth', 'finance'],
    ['/chat/thread-1', 'chat'],
    ['/account/profile', 'account'],
    ['/groups', 'groups'],
    ['/payments/plans', 'payments'],
    ['/admin/users', 'admin']
  ])('counts %s under %s', (pathname, expected) => {
    expect(moduleOf(pathname)).toBe(expected);
  });

  it('counts nothing for the shell’s documents and unknown addresses', () => {
    expect(moduleOf('/privacy')).toBeNull();
    expect(moduleOf('/terms')).toBeNull();
    expect(moduleOf('/share')).toBeNull();
    expect(moduleOf('/albumsomething')).toBeNull();
  });
});

describe('currentPlatform', () => {
  it('is a browser tab by default', () => {
    expect(currentPlatform()).toBe('web');
  });

  it('is an installed app when the page runs standalone', () => {
    standalone(true);
    expect(currentPlatform()).toBe('pwa');
  });

  it('is an installed app on iOS, which says so another way', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(currentPlatform()).toBe('pwa');
  });

  it('is the wrapper when inside a native app', () => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    expect(currentPlatform()).toBe('ios');
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    expect(currentPlatform()).toBe('android');
  });

  it('copes with a browser that has no matchMedia', () => {
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    expect(currentPlatform()).toBe('web');
  });
});

describe('recordVisit', () => {
  it('posts the visit to the auth service, to survive the page going away', async () => {
    recordVisit();

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://auth.example/auth/activity');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', keepalive: true });
    expect(JSON.parse(init!.body as string)).toEqual({ kind: 'visit', platform: 'web' });
  });

  it('says where the app is running', async () => {
    standalone(true);

    recordVisit();

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]!.body as string).platform).toBe('pwa');
  });

  it('never shows a failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    expect(() => recordVisit()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('does not bounce anyone to the sign-in page when the session has ended', async () => {
    const onUnauthorized = vi.fn();
    Object.defineProperty(window, 'location', { value: { assign: onUnauthorized }, configurable: true });
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as unknown as typeof fetch;

    recordVisit();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('recordOpen', () => {
  it('posts a page open with its module', async () => {
    recordOpen('/album/albums');

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]!.body as string)).toEqual({
      kind: 'open',
      module: 'album',
      platform: 'web'
    });
  });

  it('sends nothing for an address that is not one of the app’s pages', () => {
    recordOpen('/privacy');

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('repeated opens', () => {
  afterEach(() => vi.useRealTimers());

  it('does not report the same page twice in quick succession', () => {
    vi.useFakeTimers();

    recordOpen('/album');
    recordOpen('/album/albums');
    vi.advanceTimersByTime(MIN_REOPEN_MS - 1);
    recordOpen('/album');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports it again once it has been a while', () => {
    vi.useFakeTimers();

    recordOpen('/album');
    vi.advanceTimersByTime(MIN_REOPEN_MS);
    recordOpen('/album');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps each page to itself', () => {
    recordOpen('/album');
    recordOpen('/chat');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not hold back a visit', () => {
    recordOpen('/album');
    recordVisit();
    recordVisit();

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
