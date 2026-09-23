import { Response } from 'express';
import { logger } from '@tumbaland/backend-core';

/**
 * Who has a collage open right now, and a way to tell them what changed.
 *
 * In memory, like chat-service's stream hub, for the same reason: every
 * service here runs as one replica. Past one replica this needs a pub/sub bus
 * in front of `publish`, and replacing this file is all that takes.
 *
 * Each open editor is a "viewer", one per browser tab, named by a session id
 * the tab makes up. The tab's own changes are not echoed back to it: it
 * already has them, and applying them twice would fight its undo.
 */

export const HEARTBEAT_MS = 25_000;

/**
 * How long one stream runs before the server closes it and the browser
 * reconnects. Access is checked when a stream opens, so this bounds how long
 * someone taken out of a group could keep watching.
 */
export const MAX_STREAM_AGE_MS = 30 * 60 * 1000;

/** More than anyone needs on one collage; stops a leaking page filling memory. */
export const MAX_VIEWERS_PER_COLLAGE = 20;

export type LiveEvent = 'ready' | 'changes' | 'presence' | 'reload' | 'moving';

export interface ViewerInfo {
  session: string;
  userId: string;
  name: string;
  picture: string | null;
  /** The item this viewer has selected, for the others to see outlined. */
  selection: string | null;
}

interface Viewer extends ViewerInfo {
  res: Response;
}

const rooms = new Map<string, Map<string, Viewer>>();

export function formatFrame(event: LiveEvent, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function write(collageId: string, viewer: Viewer, frame: string): void {
  try {
    viewer.res.write(frame);
  } catch (error) {
    // A half-closed socket throws. One dead viewer must not stop the rest.
    logger.warn('Dropping collage viewer after a failed write', {
      collageId,
      error: (error as Error).message
    });
    // Only this entry: the same tab may already have reconnected under the
    // same session, and that newer stream is alive.
    const room = rooms.get(collageId);
    if (room?.get(viewer.session) === viewer) room.delete(viewer.session);
  }
}

/** Adds a viewer. Returns how to remove it, or null when the collage is full. */
export function join(collageId: string, viewer: ViewerInfo & { res: Response }): (() => void) | null {
  let room = rooms.get(collageId);
  if (!room) {
    room = new Map();
    rooms.set(collageId, room);
  }
  if (room.size >= MAX_VIEWERS_PER_COLLAGE && !room.has(viewer.session)) {
    logger.warn('Refusing collage viewer: collage is full', { collageId, open: room.size });
    return null;
  }

  const entry: Viewer = { ...viewer };
  room.set(viewer.session, entry);

  return () => {
    const current = rooms.get(collageId);
    // A reconnect under the same session may already have replaced this entry.
    if (current?.get(viewer.session) === entry) current.delete(viewer.session);
    if (current && current.size === 0) rooms.delete(collageId);
  };
}

/** Everyone with the collage open. */
export function viewersOf(collageId: string): ViewerInfo[] {
  return [...(rooms.get(collageId)?.values() ?? [])].map(({ res: _res, ...info }) => info);
}

/** Sends an event to everyone with the collage open, except the tab it came from. */
export function publish(collageId: string, event: LiveEvent, data: unknown, exceptSession?: string): void {
  const room = rooms.get(collageId);
  if (!room) return;
  const frame = formatFrame(event, data);
  for (const viewer of [...room.values()]) {
    if (viewer.session !== exceptSession) write(collageId, viewer, frame);
  }
}

/** Tells everyone who is here and what each has selected. */
export function publishPresence(collageId: string): void {
  publish(collageId, 'presence', { viewers: viewersOf(collageId) });
}

/**
 * Whether this tab has the collage open, and belongs to this person. Only
 * they may speak for it, so one person cannot move the other's outline.
 */
export function isViewer(collageId: string, session: string, userId: string): boolean {
  return rooms.get(collageId)?.get(session)?.userId === userId;
}

/** Records what a viewer has selected. */
export function setSelection(collageId: string, session: string, userId: string, selection: string | null): boolean {
  const viewer = rooms.get(collageId)?.get(session);
  if (!viewer || viewer.userId !== userId) return false;
  if (viewer.selection === selection) return true;
  viewer.selection = selection;
  publishPresence(collageId);
  return true;
}

/**
 * Ends every stream, for shutdown. An open stream never finishes by itself,
 * so without this the server cannot drain; the browsers reconnect to the new
 * container on their own.
 */
export function closeAll(): void {
  for (const room of rooms.values()) {
    for (const viewer of room.values()) {
      try {
        viewer.res.write('retry: 2000\n\n');
        viewer.res.end();
      } catch {
        // Already gone.
      }
    }
  }
  rooms.clear();
}
