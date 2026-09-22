import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { caller, requireConversation } from '../services/accessService';
import * as calls from '../services/callService';
import { iceConfig } from '../services/iceService';

/**
 * GET /api/chat/calls/ice-servers
 *
 * Signed in is enough: the credentials are short-lived, relay only to whoever
 * the browser is already talking to, and are what any call needs before it
 * knows which conversation it belongs to. Never cached, since each answer
 * carries a fresh credential.
 */
export const iceServers = async (_req: Request, res: Response): Promise<void> => {
  res.set('Cache-Control', 'no-store');
  sendSuccess(res, await iceConfig());
};

/** GET /api/chat/calls/current: the call ringing or running for this person, or null. */
export const current = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await calls.currentCall(caller(req)));
};

/** POST /api/chat/conversations/:id/calls */
export const start = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  sendSuccess(res, await calls.startCall(person, conversation, req.body.deviceId), undefined, 201);
};

export const accept = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await calls.acceptCall(caller(req), req.params.callId as string, req.body.deviceId));
};

export const decline = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await calls.declineCall(caller(req), req.params.callId as string));
};

export const end = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await calls.endCall(caller(req), req.params.callId as string));
};

export const signal = async (req: Request, res: Response): Promise<void> => {
  await calls.relaySignal(caller(req), req.params.callId as string, req.body.deviceId, req.body.data);
  res.status(204).send();
};
