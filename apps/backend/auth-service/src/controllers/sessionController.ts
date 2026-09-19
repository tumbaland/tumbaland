import type { Request, Response } from 'express';
import { NotFoundError, logger, sendSuccess } from '@tumbaland/backend-core';
import {
  clearSessionCookies,
  listSessions,
  revokeOtherSessions as endOtherSessions,
  revokeSession as endSession
} from '../services/sessionService';
import { describeUserAgent } from '../services/userAgent';

/**
 * Where the person is signed in. Always their own sessions: the owner comes
 * from the caller's session and scopes every query, never from the path.
 */
export const getSessions = async (req: Request, res: Response): Promise<void> => {
  const sessions = await listSessions(req.user!.id);
  sendSuccess(
    res,
    sessions.map((session) => ({
      id: session._id.toString(),
      device: describeUserAgent(session.userAgent),
      country: session.country ?? null,
      method: session.method,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: session._id.toString() === req.user!.sid
    }))
  );
};

/** Signs one device out. Revoking the current one signs this browser out too. */
export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(id) || !(await endSession(req.user!.id, id))) {
    throw new NotFoundError('Session not found');
  }
  const signedOut = id === req.user!.sid;
  if (signedOut) clearSessionCookies(res);
  logger.info('Session revoked', { userId: req.user!.id, sessionId: id, current: signedOut });
  sendSuccess(res, { signedOut });
};

/** "Sign out everywhere else": every session but the one making the request. */
export const revokeOtherSessions = async (req: Request, res: Response): Promise<void> => {
  const revoked = await endOtherSessions(req.user!.id, req.user!.sid);
  logger.info('Other sessions revoked', { userId: req.user!.id, revoked });
  sendSuccess(res, { revoked });
};
