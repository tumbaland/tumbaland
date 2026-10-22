import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { caller, requireConversation } from '../services/accessService';
import * as live from '../services/liveLocationService';

/** GET /api/chat/conversations/:id/live: who is sharing where they are, now. */
export const list = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  res.set('Cache-Control', 'no-store');
  sendSuccess(res, await live.listShares(conversation));
};

/** PUT /api/chat/conversations/:id/live: start sharing, or run on for longer. */
export const start = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  sendSuccess(res, await live.startShare(person, conversation, req.body as live.StartInput));
};

/** POST /api/chat/conversations/:id/live/position */
export const position = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  sendSuccess(res, await live.updatePosition(person, conversation, req.body as live.LivePositionInput));
};

/** DELETE /api/chat/conversations/:id/live */
export const stop = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  await live.stopShare(person, conversation);
  res.status(204).send();
};

/** PUT /api/chat/conversations/:id/live/:userId/watch */
export const watch = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  const { lat, lng, radiusM } = req.body as { lat: number; lng: number; radiusM: number };
  sendSuccess(res, await live.watchShare(person, conversation, req.params.userId as string, { lat, lng, radiusM }));
};

/** DELETE /api/chat/conversations/:id/live/:userId/watch */
export const unwatch = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  sendSuccess(res, await live.unwatchShare(person, conversation, req.params.userId as string));
};
