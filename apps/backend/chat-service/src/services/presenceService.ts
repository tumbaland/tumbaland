import { logger } from '@tumbaland/backend-core';
import { Presence } from '../models/Presence';
import type { Caller } from './accessService';
import { isOnline, publishToGroup } from './streamHub';

/**
 * Who is using Tumbaland right now.
 *
 * Someone counts as online while they hold a chat stream open, or for a short
 * while after any chat request. The second half is what makes this mean "using
 * the app" rather than "has the chat open": the shell asks for the unread count
 * every minute while it is on screen, and stops while it is hidden, so that
 * poll doubles as a heartbeat without costing a request of its own.
 *
 * Held in memory, like the stream it sits beside, so it shares streamHub's
 * limit: one replica. The last-active time is written through to the database
 * (at most once a minute per person) so it outlives a restart.
 */

/** How long after the last sign of life someone still counts as online. Longer than the shell's 60s poll. */
export const ACTIVE_WINDOW_MS = 90_000;

/** How often the sweep looks for people who have drifted offline. */
export const SWEEP_MS = 15_000;

const PERSIST_EVERY_MS = 60_000;

interface Entry {
  lastSeen: number;
  /** The groups to tell about a change, as of the last request. */
  groups: string[];
  /** What the group was last told, so each change is announced once. */
  announced: boolean;
  persistedAt: number;
}

const entries = new Map<string, Entry>();

export interface PresenceView {
  userId: string;
  online: boolean;
  /** Null when they have never been seen. */
  lastActiveAt: string | null;
}

function onlineNow(userId: string, entry: Entry | undefined, now = Date.now()): boolean {
  if (!entry) return false;
  return isOnline(userId) || now - entry.lastSeen < ACTIVE_WINDOW_MS;
}

function announce(userId: string, entry: Entry, online: boolean): void {
  entry.announced = online;
  const payload: PresenceView = {
    userId,
    online,
    lastActiveAt: new Date(entry.lastSeen).toISOString()
  };
  for (const groupId of entry.groups) {
    publishToGroup(groupId, { type: 'presence', conversationId: '', at: Date.now(), payload }, userId);
  }
}

async function persist(userId: string, entry: Entry, now: number): Promise<void> {
  entry.persistedAt = now;
  await Presence.updateOne(
    { userId },
    { $max: { lastActiveAt: new Date(entry.lastSeen) }, $setOnInsert: { userId } },
    { upsert: true }
  );
}

/**
 * Notes a sign of life. Called on every chat request and when a stream opens
 * or closes. Never throws: presence is a nicety, and a request must not fail
 * because it could not be recorded.
 */
export async function touch(person: Caller): Promise<void> {
  try {
    const now = Date.now();
    let entry = entries.get(person.id);
    if (!entry) {
      entry = { lastSeen: now, groups: person.groups, announced: false, persistedAt: 0 };
      entries.set(person.id, entry);
    }
    entry.lastSeen = now;
    entry.groups = person.groups;

    if (now - entry.persistedAt > PERSIST_EVERY_MS) await persist(person.id, entry, now);

    const online = onlineNow(person.id, entry, now);
    if (online !== entry.announced) announce(person.id, entry, online);
  } catch (error) {
    logger.warn('Could not record presence', { error: (error as Error).message });
  }
}

/**
 * Announces anyone who has gone quiet, and forgets people long gone. Run on a
 * timer, because going offline is the absence of an event.
 */
export function sweep(now = Date.now()): void {
  for (const [userId, entry] of entries) {
    const online = onlineNow(userId, entry, now);
    if (online !== entry.announced) announce(userId, entry, online);
    // An hour quiet: the database has their last-active time; memory need not.
    if (!online && now - entry.lastSeen > 60 * 60 * 1000) entries.delete(userId);
  }
}

/** Starts the sweep. Returns the stop function, for shutdown. */
export function startPresenceSweep(): () => void {
  const timer = setInterval(() => sweep(), SWEEP_MS);
  timer.unref();
  return () => clearInterval(timer);
}

/** Online state and last-active time for these people. */
export async function presenceFor(userIds: string[]): Promise<PresenceView[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];

  const stored = new Map((await Presence.find({ userId: { $in: unique } })).map((row) => [row.userId, row]));
  const now = Date.now();

  return unique.map((userId) => {
    const row = stored.get(userId);
    const entry = entries.get(userId);
    const seen = Math.max(entry?.lastSeen ?? 0, row?.lastActiveAt?.getTime() ?? 0);
    return {
      userId,
      online: onlineNow(userId, entry, now),
      lastActiveAt: seen > 0 ? new Date(seen).toISOString() : null
    };
  });
}

/** Test seam: forgets everyone. Never called in normal operation. */
export function clearPresence(): void {
  entries.clear();
}
