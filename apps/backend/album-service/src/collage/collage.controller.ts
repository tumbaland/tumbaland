import { Request, Response } from 'express';
import { BadRequestError, NotFoundError, SSE_HEARTBEAT_MS, openSseStream } from '@tumbaland/backend-core';
import * as collageService from './collage.service';
import * as live from './collageLive';
import { noteLeft, nudgeChat } from './chatCollage';

/** A tab's own made-up id: letters, digits and dashes, like a UUID. */
const SESSION = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Create a new collage
 */
export const createCollage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  // Who made it is settled by the credential, never by the request body.
  const madeBy = req.apiKey ? { kind: 'assistant' as const, label: req.apiKey.label } : undefined;
  const collage = await collageService.createCollage(req.body, user.id, userGroups, madeBy);
  res.status(201).json({
    success: true,
    message: 'Collage created successfully',
    data: collage
  });
};

/**
 * Update collage
 */
export const updateCollage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const collage = await collageService.updateCollage(id as string, req.body, user.id, userGroups);
  // A whole-collage write replaces what everyone has open: they reload it.
  live.publish(id as string, 'reload', { revision: collage?.revision });
  res.json({
    success: true,
    message: 'Collage updated successfully',
    data: collage
  });
};

/**
 * Apply a batch of small changes: what the editor sends as it autosaves.
 */
export const applyCollageChanges = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const { changes, session } = req.body as { changes: collageService.CollageChanges; session?: string };
  const assistant = Boolean(req.apiKey);
  const result = await collageService.applyCollageChanges(id as string, changes, user.id, userGroups, { assistant });
  // An assistant has no tab and no session, so everyone with the collage open
  // gets its changes, under the name its connection was given.
  const by = assistant
    ? { userId: user.id, name: req.apiKey!.label, assistant: true }
    : { userId: user.id, name: user.name };
  live.publish(id as string, 'changes', { revision: result.revision, changes, by }, session);
  res.json({ success: true, data: result });
};

/**
 * POST /api/collages/:id/albums
 *
 * Add albums to the ones a collage takes its photos from.
 */
export const addCollageAlbums = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params as { id: string };
  const { add } = req.body as { add: string[] };

  const result = await collageService.addCollageAlbums(id, add, user.id, req.userGroups || [], {
    assistant: Boolean(req.apiKey)
  });
  // An open editor fetches the collage's photos again on this, so the new
  // albums show up in its tray.
  live.publish(id, 'photos', {});
  res.json({ success: true, data: result });
};

/**
 * GET /api/collages/:id/live?session=...
 *
 * A Server-Sent Events stream of what the other people with this collage open
 * are doing: their saved changes, who is here, and what each has selected.
 * The stream itself (headers, heartbeat, lifetime, cleanup) is backend-core's,
 * shared with chat.
 */
export const liveStream = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params as { id: string };
  const session = typeof req.query.session === 'string' ? req.query.session : '';
  if (!SESSION.test(session)) throw new BadRequestError('session is required');

  // Checked before the stream opens, while an error can still be a status code.
  const collage = await collageService.getCollageById(id, user.id, req.userGroups || []);
  if (!collage) throw new NotFoundError('Collage not found');

  const stream = openSseStream(res);

  const leave = live.join(id, {
    session,
    userId: user.id,
    name: user.name || user.email,
    picture: user.picture ?? null,
    selection: null,
    stream
  });
  if (!leave) {
    stream.end(live.formatFrame('ready', { error: 'too_many_viewers' }));
    return;
  }

  // The revision lets the editor see whether anything was saved between its
  // loading the collage and this stream opening, and fetch it if so.
  stream.send(live.formatFrame('ready', { heartbeatMs: SSE_HEARTBEAT_MS, revision: collage.revision ?? 0 }));
  live.publishPresence(id);

  const chatCollage = { id, title: collage.title, conversationId: collage.conversationId };
  const present = live.viewersOf(id).map((viewer) => viewer.userId);
  nudgeChat(chatCollage, { id: user.id, name: user.name || user.email }, present);

  stream.onClose(() => {
    leave();
    live.publishPresence(id);
    noteLeft(chatCollage, user.id);
  });
};

/**
 * POST /api/collages/:id/moving
 *
 * Where an item is while someone drags, resizes or turns it, about ten times a
 * second, so the others see it move rather than jump when it is let go.
 * Passed straight on and never stored: the save at the end of the gesture is
 * what counts. `item: null` means it was let go.
 */
export const reportMoving = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params as { id: string };
  const { session, item } = req.body as { session: string; item: Record<string, number | string> | null };

  if (!live.isViewer(id, session, user.id)) throw new NotFoundError('Not watching this collage');
  live.publish(id, 'moving', { session, userId: user.id, name: user.name || user.email, item }, session);
  res.status(204).end();
};

/**
 * POST /api/collages/:id/presence
 *
 * What this tab has selected, for the others to see outlined. Only a tab with
 * the stream open counts; anyone else is answered as not found.
 */
export const setPresence = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params as { id: string };
  const { session, selection } = req.body as { session: string; selection: string | null };

  if (!live.setSelection(id, session, user.id, selection)) {
    throw new NotFoundError('Not watching this collage');
  }
  res.status(204).end();
};

/**
 * Get collage by ID with photos
 */
export const getCollageById = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  // `urls=0` skips signing the photos' links, for callers that only read about them.
  const result = await collageService.getCollageWithPhotos(id as string, user.id, userGroups, {
    signUrls: req.query.urls !== '0'
  });

  res.json({
    success: true,
    data: {
      collage: result.collage,
      photos: result.photos
    }
  });
};

/**
 * Get collages list
 */
export const getCollageList = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { albumId, groupId } = req.query;

  const collages = await collageService.getCollageList(
    albumId as string | undefined,
    user.id,
    userGroups,
    groupId as string | undefined
  );

  res.json({
    success: true,
    data: collages
  });
};

/**
 * Delete collage
 */
export const deleteCollage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await collageService.deleteCollage(id as string, user.id, userGroups);

  res.json({
    success: true,
    message: 'Collage deleted successfully'
  });
};
