import webpush from 'web-push';
import { logger } from '@tumbaland/backend-core';
import { PushSubscription } from '../models/PushSubscription';

/**
 * Web Push delivery.
 *
 * Push is a nudge, never the source of truth. Both mobile platforms drop
 * notifications for a backgrounded PWA under memory pressure, iOS more than
 * Android, so nothing here may be load-bearing: the unread count in the app is
 * what is correct, and a failed send is logged rather than retried.
 */

/** A device that has asked not to show message text on screen. */
export interface PushPayload {
  title: string;
  body: string;
  /** Collapses repeat notifications for one conversation into one. */
  tag: string;
  url: string;
  unread?: number;
}

let configured: boolean | null = null;

/**
 * Configures web-push from the environment, once.
 *
 * Deliberately lazy and deliberately non-fatal. A deployment without VAPID keys
 * is a deployment without notifications, which is a degraded chat rather than a
 * broken one; throwing at import time would take the whole service down over an
 * optional feature. (The same mistake payment-service makes with its Stripe
 * key, which is why a missing key there stops the service from starting at all.)
 */
export function isPushConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    logger.warn('Web Push is not configured; chat notifications are disabled', {
      hasPublicKey: Boolean(publicKey),
      hasPrivateKey: Boolean(privateKey),
      hasSubject: Boolean(subject)
    });
    configured = false;
    return configured;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return configured;
}

/** Test seam: forgets the cached configuration so env changes take effect. */
export function resetPushConfig(): void {
  configured = null;
}

/** Records or refreshes one browser's endpoint. */
export async function saveSubscription(
  userId: string,
  input: { endpoint: string; keys: { p256dh: string; auth: string }; platform?: string },
  userAgent?: string
): Promise<void> {
  await PushSubscription.updateOne(
    { endpoint: input.endpoint },
    {
      $set: {
        // An endpoint can move between accounts on a shared device, so the
        // owner is set rather than only inserted.
        userId,
        keys: input.keys,
        userAgent: userAgent ?? '',
        platform: input.platform ?? '',
        lastSeenAt: new Date(),
        // A re-register is proof the endpoint is alive, so past failures are
        // forgiven. Without this a device that was offline for a week stays
        // one failure away from being pruned forever.
        failureCount: 0
      },
      $setOnInsert: { endpoint: input.endpoint }
    },
    { upsert: true }
  );
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await PushSubscription.deleteOne({ endpoint, userId });
}

/**
 * Sends to every device the recipients have registered.
 *
 * Failures are handled per endpoint: a 404 or 410 means the browser threw the
 * subscription away and the row is deleted immediately. Anything else is
 * counted for diagnostics. Temporary provider outages must not permanently
 * unsubscribe phones that are still registered.
 */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!isPushConfigured() || userIds.length === 0) return 0;

  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } });
  if (subscriptions.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          body,
          { TTL: 60 * 60, urgency: 'high', timeout: 10_000 }
        );
        delivered++;
        if (subscription.failureCount > 0) {
          await PushSubscription.updateOne({ _id: subscription._id }, { $set: { failureCount: 0 } });
        }
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        if (status === 404 || status === 410) {
          // The browser unsubscribed or the app was uninstalled. Not an error.
          await PushSubscription.deleteOne({ _id: subscription._id });
          return;
        }

        await PushSubscription.updateOne({ _id: subscription._id }, { $inc: { failureCount: 1 } });

        logger.warn('Web Push send failed', { status, error: (error as Error).message });
      }
    })
  );

  return delivered;
}
