import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => globalConfig
}));
vi.mock('./platform', () => ({ isNativeApp: () => native }));

import {
  decodeKey,
  disableNotifications,
  enableNotifications,
  forgetDeviceOnServer,
  isAppleBrowser,
  isStandalone,
  pushSupport,
  refreshSubscription,
  setBadge
} from './pushNotifications';

let globalConfig: Record<string, string | undefined> = {};
let native = false;

const subscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }),
  unsubscribe: vi.fn().mockResolvedValue(true)
};

const pushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn()
};

function setupBrowser(
  options: { permission?: NotificationPermission; hasPush?: boolean; standalone?: boolean; ua?: string } = {}
) {
  const {
    permission = 'default',
    hasPush = true,
    standalone = false,
    ua = 'Mozilla/5.0 (Linux; Android 14)'
  } = options;

  vi.stubGlobal('navigator', {
    userAgent: ua,
    platform: 'test',
    standalone,
    serviceWorker: { ready: Promise.resolve({ pushManager }), getRegistration: () => Promise.resolve({ pushManager }) },
    setAppBadge: vi.fn().mockResolvedValue(undefined),
    clearAppBadge: vi.fn().mockResolvedValue(undefined)
  });

  const NotificationStub = hasPush
    ? Object.assign(vi.fn(), { permission, requestPermission: vi.fn().mockResolvedValue(permission) })
    : undefined;

  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: standalone }),
    navigator: globalThis.navigator,
    // The shared logger reads window.location.href when it reports a warning,
    // so a stub without it turns a logged warning into an unhandled rejection.
    location: { href: 'https://tumbaland.test/' },
    ...(hasPush ? { PushManager: vi.fn(), Notification: NotificationStub } : {})
  });
  if (hasPush) vi.stubGlobal('Notification', NotificationStub);
  vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ put: vi.fn().mockResolvedValue(undefined) }) });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { configured: true } }) }));
  vi.stubGlobal('Response', class {});

  return NotificationStub;
}

beforeEach(() => {
  globalConfig = { CHAT_API_URL: 'https://chat-api.test', VAPID_PUBLIC_KEY: 'BJxwLaGZ' };
  native = false;
  pushManager.getSubscription.mockResolvedValue(null);
  pushManager.subscribe.mockResolvedValue(subscription);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('decodeKey', () => {
  it('turns base64url into raw bytes', () => {
    // '-' and '_' are base64url, and the padding is stripped.
    const bytes = new Uint8Array(decodeKey('SGVsbG8'));

    expect(new TextDecoder().decode(bytes)).toBe('Hello');
  });

  it('returns an ArrayBuffer, which is what applicationServerKey accepts', () => {
    expect(decodeKey('SGVsbG8')).toBeInstanceOf(ArrayBuffer);
  });
});

describe('isAppleBrowser', () => {
  it.each([['iPhone'], ['iPad'], ['iPod']])('recognises an %s', (device) => {
    expect(isAppleBrowser(`Mozilla/5.0 (${device}; CPU OS 17_0)`)).toBe(true);
  });

  it('does not treat Android as Apple', () => {
    expect(isAppleBrowser('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });
});

describe('isStandalone', () => {
  it('is true when the display mode says standalone', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} } as unknown as Window)).toBe(true);
  });

  it('honours Safari’s own flag, which is the only signal on iOS', () => {
    expect(
      isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } } as unknown as Window)
    ).toBe(true);
  });

  it('is false in an ordinary tab', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} } as unknown as Window)).toBe(false);
  });
});

describe('pushSupport', () => {
  it('is ready once permission has been granted', () => {
    setupBrowser({ permission: 'granted' });

    expect(pushSupport()).toBe('ready');
  });

  it('needs permission before anything has been asked', () => {
    setupBrowser({ permission: 'default' });

    expect(pushSupport()).toBe('needs-permission');
  });

  it('reports denied, which only the browser can undo', () => {
    setupBrowser({ permission: 'denied' });

    expect(pushSupport()).toBe('denied');
  });

  it('tells an iPhone in a tab to install, not that it is unsupported', () => {
    // On iOS in a tab the API is missing entirely rather than denied, so
    // without this the person is told the wrong thing.
    setupBrowser({ hasPush: false, standalone: false, ua: 'Mozilla/5.0 (iPhone; CPU OS 17_0)' });

    expect(pushSupport()).toBe('needs-install');
  });

  it('is unsupported on a desktop browser with no Push API', () => {
    setupBrowser({ hasPush: false, ua: 'Mozilla/5.0 (Windows NT 10.0)' });

    expect(pushSupport()).toBe('unsupported');
  });

  it('is unsupported inside a native wrapper, which has its own notifications', () => {
    setupBrowser({ permission: 'granted' });
    native = true;

    expect(pushSupport()).toBe('unsupported');
  });
});

describe('enableNotifications', () => {
  it('subscribes and registers the endpoint with the server', async () => {
    const Notification = setupBrowser({ permission: 'granted' })!;
    Notification.requestPermission.mockResolvedValue('granted');

    expect(await enableNotifications()).toBe('ready');
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(fetch).toHaveBeenCalledWith(
      'https://chat-api.test/api/chat/push/subscriptions',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it.each([401, 500])('does not claim success when registration fails (%i)', async (status) => {
    setupBrowser({ permission: 'granted' });
    vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response);
    await expect(enableNotifications()).rejects.toThrow('Could not save notification settings');
  });

  it('reports missing server VAPID configuration', async () => {
    setupBrowser({ permission: 'granted' });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { configured: false } }) } as Response);
    await expect(enableNotifications()).rejects.toThrow('not configured');
  });

  it('reuses an existing subscription rather than making a second one', async () => {
    const Notification = setupBrowser({ permission: 'granted' })!;
    Notification.requestPermission.mockResolvedValue('granted');
    pushManager.getSubscription.mockResolvedValue(subscription);

    await enableNotifications();

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalled();
  });

  it('stashes the key where the worker can re-subscribe with it', async () => {
    const Notification = setupBrowser({ permission: 'granted' })!;
    Notification.requestPermission.mockResolvedValue('granted');

    await enableNotifications();

    // `pushsubscriptionchange` has no other storage that survives a restart.
    expect(caches.open).toHaveBeenCalled();
  });

  it('stops at denied without subscribing', async () => {
    const Notification = setupBrowser({ permission: 'default' })!;
    Notification.requestPermission.mockResolvedValue('denied');

    expect(await enableNotifications()).toBe('denied');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('does nothing when the deployment has no VAPID key', async () => {
    setupBrowser({ permission: 'granted' });
    globalConfig.VAPID_PUBLIC_KEY = undefined;

    await expect(enableNotifications()).rejects.toThrow();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('never prompts on a platform that cannot deliver', async () => {
    const Notification = setupBrowser({ hasPush: false, ua: 'Mozilla/5.0 (iPhone; CPU OS 17_0)' });

    expect(await enableNotifications()).toBe('needs-install');
    expect(Notification).toBeUndefined();
  });

  it('reports a retryable error when subscribing fails', async () => {
    const Notification = setupBrowser({ permission: 'granted' })!;
    Notification.requestPermission.mockResolvedValue('granted');
    pushManager.subscribe.mockRejectedValue(new Error('AbortError'));

    await expect(enableNotifications()).rejects.toThrow();
  });
});

describe('disableNotifications', () => {
  it('unsubscribes and tells the server', async () => {
    setupBrowser({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(subscription);

    await disableNotifications();

    expect(fetch).toHaveBeenCalledWith(
      'https://chat-api.test/api/chat/push/subscriptions',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('still disables the browser subscription when the server is offline', async () => {
    setupBrowser({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(subscription);
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await expect(disableNotifications()).resolves.toBeUndefined();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('does not claim success if the browser refuses to unsubscribe', async () => {
    setupBrowser({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(subscription);
    subscription.unsubscribe.mockResolvedValueOnce(false);
    await expect(disableNotifications()).rejects.toThrow('Could not disable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does nothing when there is no subscription', async () => {
    setupBrowser({ permission: 'granted' });

    await disableNotifications();

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('forgetDeviceOnServer', () => {
  it('tells the server to stop sending here, and keeps the browser subscribed for the next sign-in', async () => {
    setupBrowser({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(subscription);

    await forgetDeviceOnServer();

    expect(fetch).toHaveBeenCalledWith(
      'https://chat-api.test/api/chat/push/subscriptions',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) })
    );
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it('never fails a sign-out', async () => {
    setupBrowser({ permission: 'granted' });
    pushManager.getSubscription.mockRejectedValue(new Error('broken'));

    await expect(forgetDeviceOnServer()).resolves.toBeUndefined();
  });

  it('does nothing when this device never subscribed', async () => {
    setupBrowser({ permission: 'granted' });

    await forgetDeviceOnServer();

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('refreshSubscription', () => {
  it('re-registers on every start, so a rotated endpoint is noticed', async () => {
    setupBrowser({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(subscription);

    await refreshSubscription();

    expect(fetch).toHaveBeenCalledWith(
      'https://chat-api.test/api/chat/push/subscriptions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('never prompts: it does nothing when permission has not been granted', async () => {
    setupBrowser({ permission: 'default' });

    await refreshSubscription();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does nothing when there is no subscription to refresh', async () => {
    setupBrowser({ permission: 'granted' });

    await refreshSubscription();

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('setBadge', () => {
  it('sets the dot on the app icon', () => {
    setupBrowser({ permission: 'granted' });

    setBadge(3);

    expect(navigator.setAppBadge).toHaveBeenCalledWith(3);
  });

  it('clears it at zero rather than showing a zero', () => {
    setupBrowser({ permission: 'granted' });

    setBadge(0);

    expect(navigator.clearAppBadge).toHaveBeenCalled();
  });

  it('is a no-op where the API is missing, such as desktop Safari', () => {
    vi.stubGlobal('navigator', { userAgent: 'x' });

    expect(() => setBadge(3)).not.toThrow();
  });
});
