import { logger } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import { isNativeApp } from './platform';

/**
 * Web Push, from the page's side.
 *
 * All of it belongs to the shell's origin, not to chat-front: a subscription is
 * owned by the service worker that created it, and there is one worker per
 * origin. chat-front runs inside this page, so it has no worker of its own.
 *
 * Nothing here is load-bearing. Both platforms drop notifications for a
 * backgrounded PWA under memory pressure, iOS more than Android, so the unread
 * count in the app stays the source of truth and this is a nudge.
 */

export type PushSupport =
  | 'ready'
  /** The API exists but the person has not been asked yet. */
  | 'needs-permission'
  /** Asked and refused. Only the browser's own UI can undo this. */
  | 'denied'
  /** iOS Safari in a tab: Web Push needs the site installed to the Home Screen. */
  | 'needs-install'
  /** No Push API at all, or a native wrapper that uses its own notifications. */
  | 'unsupported';

/** Whether this looks like an installed, standalone app rather than a tab. */
export function isStandalone(win: Window = window): boolean {
  return (
    win.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates display-mode and is still the only
    // reliable signal on iOS.
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Safari on an Apple device, where the install requirement applies. */
export function isAppleBrowser(userAgent: string = navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && 'ontouchend' in document);
}

/**
 * What this browser can actually do.
 *
 * Feature-detected rather than assumed, and the iOS case is checked before the
 * API check: on iOS in a tab `PushManager` is missing entirely rather than
 * present-and-denied, so without this the person would see "not supported" when
 * the real answer is "add it to your Home Screen first".
 */
export function pushSupport(): PushSupport {
  // A Capacitor wrapper posts through the store's own notification system;
  // Web Push inside a web view is unreliable and would double up.
  if (isNativeApp()) return 'unsupported';
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';

  if (!('PushManager' in window) || !('Notification' in window)) {
    return isAppleBrowser() && !isStandalone() ? 'needs-install' : 'unsupported';
  }

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'ready';
  return 'needs-permission';
}

/**
 * The VAPID public key, as the push API wants it: base64url in, raw bytes out.
 *
 * Returns an `ArrayBuffer` rather than the `Uint8Array` that reads more
 * naturally, because `applicationServerKey` is typed as a `BufferSource` and a
 * typed array over a possibly-shared buffer no longer satisfies that.
 */
export function decodeKey(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

const PUSH_STATE_CACHE = 'tumbaland-push-state';

async function rememberPushConfig(): Promise<void> {
  const { VAPID_PUBLIC_KEY, CHAT_API_URL } = getGlobalConfig();
  await caches.open(PUSH_STATE_CACHE)
    .then((cache) => cache.put('/__push-config', new Response(JSON.stringify({
      publicKey: VAPID_PUBLIC_KEY, apiUrl: CHAT_API_URL
    }))))
    .catch(() => undefined);
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('The app is still starting. Please try again.')), 15_000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** POSTs a subscription to chat-service, which stores it against the account. */
async function registerWithServer(subscription: PushSubscriptionJSON): Promise<void> {
  const { CHAT_API_URL } = getGlobalConfig();
  if (!CHAT_API_URL) throw new Error('Chat notifications are not configured for this deployment.');

  const response = await fetch(`${CHAT_API_URL}/api/chat/push/subscriptions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      platform: navigator.platform || ''
    })
  });
  if (!response.ok) throw new Error('Could not save notification settings. Please try again.');
  const result = (await response.json()) as { data?: { configured?: boolean } };
  if (result.data?.configured !== true) {
    throw new Error('The server is not configured to send notifications yet.');
  }
}

/**
 * Subscribes this browser and records it with the server.
 *
 * **Must be called from a user gesture.** iOS refuses a permission prompt
 * without one, and Chrome penalises a site's permission standing for asking on
 * load. The settings toggle is the gesture.
 */
export async function enableNotifications(): Promise<PushSupport> {
  const support = pushSupport();
  if (support !== 'ready' && support !== 'needs-permission') return support;

  const { VAPID_PUBLIC_KEY } = getGlobalConfig();
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Chat notifications are not configured for this deployment.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'needs-permission';

  try {
    const registration = await readyRegistration();
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(VAPID_PUBLIC_KEY)
      }));

    await registerWithServer(subscription.toJSON());
    await rememberPushConfig();
    return 'ready';
  } catch (error) {
    logger.warn('Could not subscribe to push', { error: (error as Error).message });
    throw new Error('Could not enable notifications. ' + (error as Error).message, { cause: error });
  }
}

export async function disableNotifications(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await readyRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Stop delivery on this device even if the server is temporarily offline.
    const unsubscribed = await subscription.unsubscribe();
    if (!unsubscribed && await registration.pushManager.getSubscription()) {
      throw new Error('Could not disable notifications. Please try again.');
    }
    await caches.open(PUSH_STATE_CACHE).then((cache) => cache.delete('/__push-config')).catch(() => undefined);

    await unregisterWithServer(subscription.endpoint, 15_000);
  } catch (error) {
    logger.warn('Could not unsubscribe from push', { error: (error as Error).message });
    throw error;
  }
}

async function unregisterWithServer(endpoint: string, timeoutMs: number): Promise<void> {
  const { CHAT_API_URL } = getGlobalConfig();
  if (!CHAT_API_URL) return;
  await fetch(`${CHAT_API_URL}/api/chat/push/subscriptions`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
    signal: AbortSignal.timeout(timeoutMs)
  }).catch(() => undefined);
}

/**
 * Stops this device getting the signed-out person's messages. Call before
 * signing out, while the session cookie still works.
 *
 * Only the server forgets the device. The browser keeps its subscription, so
 * whoever signs in next gets it attached to their account by
 * `refreshSubscription` without being asked for permission again. Bounded and
 * silent: signing out must never wait on, or fail over, a notification setting.
 */
export async function forgetDeviceOnServer(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) await unregisterWithServer(subscription.endpoint, 3_000);
  } catch (error) {
    logger.warn('Could not detach push from the account', { error: (error as Error).message });
  }
}

/**
 * Re-registers an existing subscription on every app start.
 *
 * Not redundant: a push endpoint can be rotated by the browser at any time, and
 * re-POSTing is how a rotation is noticed. It also refreshes `lastSeenAt` so a
 * device that has been quiet is not pruned, and clears earlier delivery
 * failures. Silent, and never prompts.
 */
export async function refreshSubscription(): Promise<void> {
  if (pushSupport() !== 'ready') return;

  try {
    const registration = await readyRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await registerWithServer(subscription.toJSON());
      await rememberPushConfig();
    }
  } catch (error) {
    logger.warn('Could not refresh the push subscription', { error: (error as Error).message });
  }
}

/** The dot on the installed app's icon. Absent on desktop Safari and older iOS. */
export function setBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
  else void nav.clearAppBadge?.().catch(() => undefined);
}
