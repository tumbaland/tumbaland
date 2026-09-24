import { formatSseFrame, logger, type SseStream } from '@tumbaland/backend-core';

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

/** More than anyone needs on one collage; stops a leaking page filling memory. */
export const MAX_VIEWERS_PER_COLLAGE = 20;

export type LiveEvent = 'ready' | 'changes' | 'presence' | 'reload' | 'moving' | 'photos';

export interface ViewerInfo {
  session: string;
  userId: string;
  name: string;
  picture: string | null;
  /** The item this viewer has selected, for the others to see outlined. */
  selection: string | null;
}

interface Viewer extends ViewerInfo {
  stream: SseStream;
}

const rooms = new Map<string, Map<string, Viewer>>();

export function formatFrame(event: LiveEvent, data: unknown): string {
  return formatSseFrame(event, data);
}

/** Adds a viewer. Returns how to remove it, or null when the collage is full. */
export function join(collageId: string, viewer: ViewerInfo & { stream: SseStream }): (() => void) | null {
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

/** The collages someone has open right now. */
export function openCollageIds(): string[] {
  return [...rooms.keys()];
}

/** Everyone with the collage open. */
export function viewersOf(collageId: string): ViewerInfo[] {
  return [...(rooms.get(collageId)?.values() ?? [])].map(({ stream: _stream, ...info }) => info);
}

/** Sends an event to everyone with the collage open, except the tab it came from. */
export function publish(collageId: string, event: LiveEvent, data: unknown, exceptSession?: string): void {
  const room = rooms.get(collageId);
  if (!room) return;
  const frame = formatFrame(event, data);
  // A failed write closes that viewer's stream, which takes them out of the
  // room; the rest are still served.
  for (const viewer of [...room.values()]) {
    if (viewer.session !== exceptSession) viewer.stream.send(frame);
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
