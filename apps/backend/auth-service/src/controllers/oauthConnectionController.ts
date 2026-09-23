import { Request, Response } from 'express';
import { listConnections, logger, NotFoundError, revokeRefreshTokensForUser, sendSuccess } from '@tumbaland/backend-core';

/**
 * The assistants a user has connected.
 *
 * Read from refresh tokens rather than a separate record, because a refresh
 * token *is* the connection: while one is live the assistant can keep minting
 * access tokens, and once it is gone the connection is over.
 */
export const getConnections = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await listConnections(req.user!.id));
};

/**
 * Disconnect an assistant.
 *
 * Revoking the refresh token is what actually cuts it off. Any access token it
 * already holds keeps working until it expires — at most an hour — which is the
 * trade made when access tokens were made stateless, and worth saying plainly
 * in the UI rather than implying the cut is instant.
 */
export const revokeConnection = async (req: Request, res: Response): Promise<void> => {
  const clientId = String(req.params.clientId);
  const revoked = await revokeRefreshTokensForUser(req.user!.id, clientId);

  if (revoked === 0) throw new NotFoundError('No active connection for that application');

  logger.info('OAuth connection revoked', { userId: req.user!.id, clientId, revoked });
  sendSuccess(res, { clientId, revoked });
};
