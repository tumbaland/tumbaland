import { logger } from '@tumbaland/frontend-core';

/**
 * Registering the worker, and noticing when a new one is waiting.
 *
 * The update is never applied silently. `skipWaiting` swaps the code under the
 * running page, which mid-conversation can throw away a half-typed message, so
 * the new worker waits until the person accepts.
 */

export type UpdateHandler = () => void;

let waitingWorker: ServiceWorker | null = null;

export interface RegisterOptions {
  /**
   * Whether to register at all. Defaults to "not in a dev build": a worker on
   * localhost is more often a stale-cache mystery than a useful test, and it
   * is exercised against a built preview instead.
   *
   * An option rather than a bare `import.meta.env.DEV` check, because that is
   * also true under the test runner, where it would skip the whole function.
   */
  enabled?: boolean;
}

/**
 * Registers `/sw.js`, after load.
 *
 * Deliberately not on first paint: registration competes with the federated
 * modules for connections on the one load that decides how fast the app feels.
 */
export function registerServiceWorker(onUpdateReady?: UpdateHandler, options: RegisterOptions = {}): void {
  const { enabled = !import.meta.env.DEV } = options;
  if (!enabled) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Already waiting from a previous visit.
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          onUpdateReady?.();
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            // `controller` is null on the very first install, which is not an
            // update and must not prompt.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              onUpdateReady?.();
            }
          });
        });
      })
      .catch((error: Error) => logger.warn('Service worker registration failed', { error: error.message }));

    // The new worker taking over is the moment to reload, rather than
    // reloading immediately after asking it to activate.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

/** Applies a waiting update. Called once the person accepts. */
export function applyUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  waitingWorker = null;
}

/** Test seam. */
export function __setWaitingWorker(worker: ServiceWorker | null): void {
  waitingWorker = worker;
}

export type WorkerMessage =
  | { type: 'NAVIGATE'; url: string }
  | { type: 'PUSH_RESUBSCRIBED'; subscription: PushSubscriptionJSON };

/**
 * Listens for the worker's messages.
 *
 * `NAVIGATE` arrives when a notification is tapped and an open window was
 * focused rather than a new one opened: the worker cannot route, so it asks
 * the page to.
 */
export function onWorkerMessage(handler: (message: WorkerMessage) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const listener = (event: MessageEvent) => {
    if (event.data && typeof event.data.type === 'string') handler(event.data as WorkerMessage);
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
