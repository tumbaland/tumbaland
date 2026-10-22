import { ConflictError, NotFoundError, logger } from '@tumbaland/backend-core';
import { Error as MongooseError } from 'mongoose';
import { IConversation } from '../models/Conversation';
import { ILiveLocation, LiveLocation } from '../models/LiveLocation';
import type { Caller } from './accessService';
import { isPushConfigured, sendToUsers } from './pushService';
import { publishToGroup } from './streamHub';

/**
 * "I am on my way": one person's position, live, in a conversation, and a
 * push to whoever is waiting when they get close.
 *
 * The phone sends its position while Tumbaland is on its screen; a browser
 * gives a page none while it is hidden. So a position can stop coming at any
 * time, and the viewers are shown how old it is rather than told it is live.
 */

/** Longest a share may be asked to run. A drive, not a day. */
export const MAX_MINUTES = 4 * 60;

/** Positions closer together than this are not worth a write and a broadcast each. */
const MIN_UPDATE_MS = 2_000;

export interface LivePositionInput {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

/** What everyone in the conversation sees. A waiter's own point is never sent, only how far off the sharer is. */
export interface LiveShareView {
  userId: string;
  name: string;
  position: {
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    at: Date;
  } | null;
  /** Where they are heading, and how far off it is in a straight line. */
  destination: { lat: number; lng: number; label: string | null; distanceM: number | null } | null;
  /** What a pin is: "Home", or an address. */
  pinLabel: string | null;
  /** A pin: one place that stays put, never old. */
  fixed: boolean;
  startedAt: Date;
  endsAt: Date;
  watchers: Array<{ userId: string; name: string; radiusM: number; distanceM: number | null; notified: boolean }>;
}

/** Metres between two points on the Earth, along its surface. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "900 m", "3.2 km": for a push, where the app's own formatting is not at hand. */
export function distanceText(metres: number): string {
  if (metres < 1000) return `${Math.max(50, Math.round(metres / 50) * 50)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

export function toView(share: ILiveLocation): LiveShareView {
  const position = share.position;
  return {
    userId: share.userId,
    name: share.name,
    position: position
      ? {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy ?? null,
          heading: position.heading ?? null,
          speed: position.speed ?? null,
          at: position.at
        }
      : null,
    destination: share.destination
      ? {
          lat: share.destination.lat,
          lng: share.destination.lng,
          label: share.destination.label ?? null,
          distanceM: position ? Math.round(distanceM(position, share.destination)) : null
        }
      : null,
    fixed: Boolean(share.fixed),
    pinLabel: share.pinLabel ?? null,
    startedAt: share.startedAt,
    endsAt: share.endsAt,
    watchers: share.watchers.map((watcher) => ({
      userId: watcher.userId,
      name: watcher.name,
      radiusM: watcher.radiusM,
      distanceM: position ? Math.round(distanceM(position, watcher)) : null,
      notified: Boolean(watcher.notifiedAt)
    }))
  };
}

function announce(conversation: IConversation, share: ILiveLocation): LiveShareView {
  const view = toView(share);
  publishToGroup(conversation.groupId, {
    type: 'live.updated',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: view
  });
  return view;
}

/** A push that never fails the request it rides on. */
function push(userIds: string[], conversation: IConversation, title: string, body: string): void {
  if (!isPushConfigured() || userIds.length === 0) return;
  const conversationId = conversation._id.toString();
  void sendToUsers(
    userIds,
    // No conversationId: the worker would hold it back as already read if the
    // chat was open a moment ago, and "almost here" must show regardless.
    { title, body, tag: `live-${conversationId}`, url: `/chat/${conversationId}` },
    // Worth nothing ten minutes late.
    { ttlSeconds: 10 * 60, topic: `live-${conversationId}`.slice(0, 32) }
  ).catch((error: Error) => logger.warn('Live location push failed', { error: error.message }));
}

async function activeShare(conversation: IConversation, userId: string): Promise<ILiveLocation | null> {
  return LiveLocation.findOne({
    conversationId: conversation._id.toString(),
    userId,
    endsAt: { $gt: new Date() }
  });
}

/** Retry concurrent position/watcher edits without overwriting someone else's change. */
async function changeShare(
  conversation: IConversation,
  userId: string,
  change: (share: ILiveLocation) => false | void | (() => void)
): Promise<LiveShareView> {
  for (let retry = 0; retry < 8; retry++) {
    const share = await activeShare(conversation, userId);
    if (!share) throw new NotFoundError('This location share has ended');
    const afterSave = change(share);
    if (afterSave === false) return toView(share);
    try {
      await share.save();
    } catch (error) {
      if (error instanceof MongooseError.VersionError) continue;
      if (error instanceof MongooseError.DocumentNotFoundError)
        throw new NotFoundError('This location share has ended');
      throw error;
    }
    if (afterSave) afterSave();
    return announce(conversation, share);
  }
  throw new ConflictError('Location changed at the same time. Try again.');
}

/** Everyone sharing in this conversation now. */
export async function listShares(conversation: IConversation): Promise<LiveShareView[]> {
  const shares = await LiveLocation.find({ conversationId: conversation._id.toString(), endsAt: { $gt: new Date() } });
  return shares.map(toView);
}

export interface StartInput {
  /** Until stopped by default, which is MAX_MINUTES at most. */
  minutes?: number;
  /** Marked on the map. `null` takes it away; left out, the one set before stays. */
  destination?: { lat: number; lng: number; label?: string } | null;
  /** What a pin is. Left out, a running share keeps its own. */
  pinLabel?: string | null;
  /** A pin rather than a live position. Left out, a running share keeps what it was. */
  fixed?: boolean;
}

/**
 * Starts sharing, or carries on a share already running (who is waiting is
 * kept). The others are told once, when it starts.
 */
export async function startShare(
  person: Caller,
  conversation: IConversation,
  input: StartInput = {}
): Promise<LiveShareView> {
  const conversationId = conversation._id.toString();
  const now = new Date();
  const endsAt = new Date(now.getTime() + Math.min(input.minutes ?? MAX_MINUTES, MAX_MINUTES) * 60_000);
  const destination = input.destination
    ? { lat: input.destination.lat, lng: input.destination.lng, label: input.destination.label || null }
    : null;

  const resume = () =>
    changeShare(conversation, person.id, (share) => {
      share.endsAt = endsAt;
      if (input.destination !== undefined) share.destination = destination;
      if (input.fixed !== undefined) share.fixed = input.fixed;
      if (input.pinLabel !== undefined) share.pinLabel = input.pinLabel || null;
    });
  if (await activeShare(conversation, person.id)) return resume();
  // A finished row the TTL sweep has not reached yet is replaced, not resumed.
  let share: ILiveLocation | null;
  try {
    share = await LiveLocation.findOneAndUpdate(
      { conversationId, userId: person.id, endsAt: { $lte: now } },
      {
        $set: {
          groupId: conversation.groupId,
          name: person.name,
          position: null,
          destination,
          fixed: Boolean(input.fixed),
          pinLabel: input.pinLabel || null,
          watchers: [],
          startedAt: now,
          endsAt
        },
        $inc: { __v: 1 }
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (error) {
    // Another tab won the first start. Resume its row instead of erasing its
    // first position/watchers or sending a second start notification.
    if ((error as { code?: number }).code === 11000) return resume();
    throw error;
  }
  const others = conversation.members.filter((member) => member.userId !== person.id).map((member) => member.userId);
  push(
    others,
    conversation,
    person.name || 'Tumbaland',
    input.fixed ? 'Shared a pin of where they are. Tap to see the map' : 'Is sharing location live. Tap to see the map'
  );
  return announce(conversation, share!);
}

/**
 * A new position from the phone. Tells anyone waiting once it comes within
 * their distance. Answers with the share as it now is, so the phone can show
 * who is waiting and how far.
 */
export async function updatePosition(
  person: Caller,
  conversation: IConversation,
  input: LivePositionInput
): Promise<LiveShareView> {
  return changeShare(conversation, person.id, (share) => {
    const now = new Date();
    // A phone sending faster than this is a loop, not a drive. Kept, not refused.
    if (share.position && now.getTime() - share.position.at.getTime() < MIN_UPDATE_MS) return false;

    share.position = {
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      at: now
    };

    const notifications: Array<() => void> = [];
    for (const watcher of share.watchers) {
      if (watcher.notifiedAt) continue;
      const away = distanceM(share.position, watcher);
      if (away > watcher.radiusM) continue;
      watcher.notifiedAt = now;
      notifications.push(() =>
        push(
          [watcher.userId],
          conversation,
          share.name ? `${share.name} is almost here` : 'Almost here',
          `${distanceText(away)} away`
        )
      );
    }
    share.markModified('watchers');
    return () => notifications.forEach((notify) => notify());
  });
}

/** Stops sharing. Nothing of it is kept. */
export async function stopShare(person: Caller, conversation: IConversation): Promise<void> {
  const conversationId = conversation._id.toString();
  const removed = await LiveLocation.findOneAndDelete({ conversationId, userId: person.id });
  if (!removed) return;
  publishToGroup(conversation.groupId, {
    type: 'live.ended',
    conversationId,
    at: Date.now(),
    payload: { userId: person.id }
  });
}

/**
 * "Tell me when they are close": the waiter's point and how close counts. One
 * per waiter, replaced by asking again. Asking when they are already that
 * close says so straight away instead of sending a push.
 */
export async function watchShare(
  person: Caller,
  conversation: IConversation,
  sharerId: string,
  input: { lat: number; lng: number; radiusM: number }
): Promise<LiveShareView> {
  return changeShare(conversation, sharerId, (share) => {
    const already = share.position ? distanceM(share.position, input) <= input.radiusM : false;
    share.watchers = [
      ...share.watchers.filter((watcher) => watcher.userId !== person.id),
      {
        userId: person.id,
        name: person.name,
        lat: input.lat,
        lng: input.lng,
        radiusM: input.radiusM,
        notifiedAt: already ? new Date() : null
      }
    ];
  });
}

export async function unwatchShare(
  person: Caller,
  conversation: IConversation,
  sharerId: string
): Promise<LiveShareView> {
  return changeShare(conversation, sharerId, (share) => {
    share.watchers = share.watchers.filter((watcher) => watcher.userId !== person.id);
  });
}
