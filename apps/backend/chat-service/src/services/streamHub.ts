import { Response } from 'express';
import { logger } from '@tumbaland/backend-core';

/**
 * In-process fan-out for the SSE stream.
 *
 * Deliberately not backed by Redis or a message bus. Every service in this repo
 * runs as a single replica, so a second process to coordinate with does not
 * exist. The cost of that choice is written down rather than hidden: while this
 * module holds the subscriber set in memory, **chat-service cannot be scaled
 * past one replica** without a pub/sub bus in front of `publish`. Adding one
 * later means replacing this file, not the callers.
 *
 * Subscribers are keyed by `User._id`, and delivery is decided by the group the
 * event belongs to, checked against the group set the subscriber authenticated
 * with. Routing by group rather than by a stored member list matters: a
 * denormalised member list lags a membership change, so using it here would
 * keep delivering messages to someone who had just been removed from the group.
 */

export type ChatEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'reaction.updated'
  | 'conversation.updated'
  | 'typing'
  | 'read'
  | 'presence'
  | 'call.ringing'
  | 'call.accepted'
  | 'call.ended'
  | 'call.signal';

export interface ChatEvent {
  type: ChatEventType;
  conversationId: string;
  /** Milliseconds since epoch, used as the SSE `id:` so a reconnect can resume. */
  at: number;
  payload: unknown;
}

interface Subscriber {
  userId: string;
  /** The groups this connection authenticated with, from `req.userGroups`. */
  groups: Set<string>;
  res: Response;
  /** The tab's call device id, when the stream says (only the call listener does). */
  deviceId: string | null;
}

/**
 * How many concurrent streams one person may hold.
 *
 * Every open app holds two: the call listener, which is always mounted, and
 * whatever chat view is open. A phone and a laptop with a second tab is six.
 * Past the cap a client falls back to polling, and calls cannot ring or
 * connect over polling, so the cap sits well clear of ordinary use.
 */
export const MAX_STREAMS_PER_USER = 12;

/**
 * Heartbeat interval. The proxy closes an idle connection at its read timeout,
 * and a client that reconnects every time that happens looks to the server like
 * a client in a reconnect loop. A comment line keeps the connection warm and
 * costs three bytes.
 */
export const HEARTBEAT_MS = 25_000;

/**
 * How long one stream may run before the server closes it and makes the client
 * reconnect.
 *
 * A stream carries the group membership it authenticated with, for its whole
 * life. Membership is otherwise re-read on every request, so an hours-long
 * stream is the one place a removed group member could keep receiving
 * messages. Recycling the connection bounds that window: the reconnect is
 * automatic, re-authenticates, and re-reads membership.
 */
export const MAX_STREAM_AGE_MS = 30 * 60 * 1000;

const subscribers = new Map<string, Set<Subscriber>>();

/** Subscribers for one person, created on demand. */
function bucket(userId: string): Set<Subscriber> {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set<Subscriber>();
    subscribers.set(userId, set);
  }
  return set;
}

/**
 * Registers a response as a live stream. Returns the unsubscribe function,
 * which the caller wires to the request's `close` event.
 *
 * Refuses past `MAX_STREAMS_PER_USER` so a page that leaks EventSource objects
 * cannot exhaust the connection pool for everyone else.
 */
export function subscribe(
  userId: string,
  groups: string[],
  res: Response,
  deviceId: string | null = null
): (() => void) | null {
  const set = bucket(userId);
  if (set.size >= MAX_STREAMS_PER_USER) {
    logger.warn('Refusing chat stream: too many open for this user', { userId, open: set.size });
    return null;
  }

  const subscriber: Subscriber = { userId, groups: new Set(groups), res, deviceId };
  set.add(subscriber);

  return () => {
    set.delete(subscriber);
    if (set.size === 0) subscribers.delete(userId);
  };
}

/** Whether this person has at least one stream open right now. */
export function isOnline(userId: string): boolean {
  return (subscribers.get(userId)?.size ?? 0) > 0;
}

/**
 * Whether this particular tab has a stream open. A call is between two tabs,
 * and the person being online on a laptop says nothing about whether the phone
 * that took the call is still there.
 */
export function isDeviceOnline(userId: string, deviceId: string): boolean {
  for (const subscriber of subscribers.get(userId) ?? []) {
    if (subscriber.deviceId === deviceId) return true;
  }
  return false;
}

/** Everyone currently connected who is in this group. */
export function onlineInGroup(groupId: string): Set<string> {
  const online = new Set<string>();
  for (const [userId, set] of subscribers) {
    for (const subscriber of set) {
      if (subscriber.groups.has(groupId)) {
        online.add(userId);
        break;
      }
    }
  }
  return online;
}

/** Open stream count, for `/metrics` and tests. */
export function openStreamCount(): number {
  let total = 0;
  for (const set of subscribers.values()) total += set.size;
  return total;
}

/** Serialises one event in the SSE wire format. */
export function formatEvent(event: ChatEvent): string {
  return `id: ${event.at}\nevent: ${event.type}\ndata: ${JSON.stringify({
    type: event.type,
    conversationId: event.conversationId,
    at: event.at,
    payload: event.payload
  })}\n\n`;
}

/**
 * Sends an event to every stream whose group set contains `groupId`, except
 * those held by `exceptUserId` where given (a sender does not need their own
 * typing indicator echoed back).
 *
 * A write to a half-closed socket throws rather than returning an error, and
 * one dead subscriber must not stop the others from being served, so each write
 * is isolated.
 */
export function publishToGroup(groupId: string, event: ChatEvent, exceptUserId?: string): void {
  const frame = formatEvent(event);

  for (const [userId, set] of subscribers) {
    if (exceptUserId && userId === exceptUserId) continue;

    for (const subscriber of set) {
      if (!subscriber.groups.has(groupId)) continue;
      try {
        subscriber.res.write(frame);
      } catch (error) {
        logger.warn('Dropping chat subscriber after a failed write', {
          userId,
          error: (error as Error).message
        });
        set.delete(subscriber);
      }
    }
    if (set.size === 0) subscribers.delete(userId);
  }
}

/**
 * Sends an event to these people only, on every device they have open, and
 * only on streams that authenticated with `groupId`. For calls: an offer is
 * for the person being called, not the whole group.
 */
export function publishToUsers(userIds: string[], groupId: string, event: ChatEvent): void {
  const frame = formatEvent(event);

  for (const userId of new Set(userIds)) {
    const set = subscribers.get(userId);
    if (!set) continue;

    for (const subscriber of set) {
      if (!subscriber.groups.has(groupId)) continue;
      try {
        subscriber.res.write(frame);
      } catch (error) {
        logger.warn('Dropping chat subscriber after a failed write', {
          userId,
          error: (error as Error).message
        });
        set.delete(subscriber);
      }
    }
    if (set.size === 0) subscribers.delete(userId);
  }
}

/**
 * Ends every open stream, for shutdown.
 *
 * Without this a rollout hangs: `server.close()` waits for in-flight responses
 * to finish and an SSE response never finishes on its own, so the graceful
 * shutdown times out and force-exits with a failure code on every deploy.
 * Closing the streams first lets the server drain normally, and the clients
 * reconnect to the new container a second later, which is what EventSource
 * does by itself.
 */
export function closeAll(): void {
  for (const set of subscribers.values()) {
    for (const subscriber of set) {
      try {
        // `retry:` tells the browser how long to wait before reconnecting.
        // Staggering is not worth it for a deployment of this size.
        subscriber.res.write('retry: 2000\n\n');
        subscriber.res.end();
      } catch {
        // Already gone; nothing to do.
      }
    }
  }
  subscribers.clear();
}

/** Test seam: drops every subscriber. Never called in normal operation. */
export function clearSubscribers(): void {
  subscribers.clear();
}
