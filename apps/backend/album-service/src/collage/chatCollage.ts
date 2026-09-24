import { NotFoundError } from '@tumbaland/backend-core';
import { Types } from 'mongoose';
import Album from '../models/Album';
import { CollageModel } from './collage.model';
import { reportCollageActivity } from '../services/chatClient';

/**
 * "Make a collage together" from a chat. The collage draws on the album the
 * chat's photos go to, so what is sent in the chat lands in its photo tray.
 * chat-service has already checked the person belongs to the group.
 */
export interface ChatCollageInput {
  groupId: string;
  userId: string;
  albumId: string;
  conversationId: string;
  clientId: string;
  title: string;
}

export interface ChatCollageResult {
  id: string;
  title: string;
}

export async function createChatCollage(input: ChatCollageInput): Promise<ChatCollageResult> {
  // Wait for the unique index before accepting concurrent creation requests.
  await CollageModel.init();
  const chatRequestKey = JSON.stringify([input.groupId, input.conversationId, input.clientId]);
  const existing = await CollageModel.findOne({ chatRequestKey });
  if (existing) return { id: existing._id.toString(), title: existing.title };

  const album = Types.ObjectId.isValid(input.albumId)
    ? await Album.findOne({ _id: input.albumId, groupId: input.groupId })
    : null;
  if (!album) throw new NotFoundError('Album not found');

  const title = input.title.trim();
  try {
    const collage = await CollageModel.create({
      title,
      chatRequestKey,
      albumIds: [album._id.toString()],
      userId: input.userId,
      groupId: input.groupId,
      conversationId: input.conversationId,
      // What the editor's own "New collage" starts from; it fills in the rest.
      config: {
        version: '2.0',
        date: new Date().toISOString(),
        viewport: { width: 1600, height: 900 },
        theme: 'default',
        photos: [],
        texts: [],
        title: { text: title, subtitle: '' }
      }
    });
    return { id: collage._id.toString(), title };
  } catch (error) {
    // Concurrent retries race at the unique index; both must return the same collage.
    if ((error as { code?: number }).code !== 11000) throw error;
    const saved = await CollageModel.findOne({ chatRequestKey });
    if (!saved) throw error;
    return { id: saved._id.toString(), title: saved.title };
  }
}

/**
 * How long someone must have been away from a collage before coming back to
 * it buzzes the others again. Opening it, closing it and coming back is one
 * session of work, not three; so is a stream recycled every 30 minutes, or a
 * tab hidden for a while.
 */
export const NUDGE_INTERVAL_MS = 30 * 60 * 1000;

/** When each person was last in each chat collage, by `collageId:userId`. */
const lastSeen = new Map<string, number>();

const keyOf = (collageId: string, userId: string) => `${collageId}:${userId}`;

function forgetOld(now: number): void {
  for (const [key, at] of lastSeen) {
    if (now - at >= NUDGE_INTERVAL_MS) lastSeen.delete(key);
  }
}

/**
 * "Tom is working on your collage", to the others in the chat the collage was
 * made from, when Tom opens it after being away for `NUDGE_INTERVAL_MS`.
 */
export function nudgeChat(
  collage: { id: string; title: string; conversationId?: string | null },
  user: { id: string; name: string },
  presentUserIds: string[],
  now = Date.now()
): void {
  if (!collage.conversationId) return;

  forgetOld(now);
  const key = keyOf(collage.id, user.id);
  // An open tab is still an active session even after its timestamp expires.
  // The joining stream is already in the room, so two entries mean another tab.
  const wasHere = lastSeen.has(key) || presentUserIds.filter((id) => id === user.id).length > 1;
  lastSeen.set(key, now);
  if (wasHere) return;

  void reportCollageActivity({
    conversationId: collage.conversationId,
    collageId: collage.id,
    title: collage.title,
    userId: user.id,
    name: user.name,
    presentUserIds: [...new Set(presentUserIds)]
  });
}

/** Someone's stream closed: the time away is counted from now, not from when they opened it. */
export function noteLeft(collage: { id: string; conversationId?: string | null }, userId: string, now = Date.now()): void {
  if (collage.conversationId) lastSeen.set(keyOf(collage.id, userId), now);
}

/** Test seam. */
export function clearNudges(): void {
  lastSeen.clear();
}
