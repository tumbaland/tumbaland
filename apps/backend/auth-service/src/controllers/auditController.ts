import { Request, Response } from 'express';
import { listAuditEvents, sendSuccess, type ActorKind } from '@tumbaland/backend-core';

/**
 * What has happened in this account, newest first.
 *
 * Served here rather than by the services that produced the rows, because the
 * question spans them: "what did Claude do yesterday" is not a journal question
 * or a photos question, and three near-identical endpoints would be three ways
 * to ask the same one. This is also where the neighbouring answers already
 * live — API keys and connected apps say what *can* reach the data, and this
 * says what actually did.
 *
 * Scoped to the caller's own userId and never to a parameter: the trail carries
 * old values and the content of deleted records, which makes it exactly as
 * sensitive as everything it describes.
 */
export const getAuditTrail = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { actorKind, action, resource, credentialId, service, from, to, page, limit } = req.query;

  const result = await listAuditEvents({
    userId: user.id,
    actorKind: actorKind as ActorKind | undefined,
    action: action as 'create' | 'update' | 'delete' | 'read' | 'call' | undefined,
    resource: resource as string | undefined,
    credentialId: credentialId as string | undefined,
    service: service as string | undefined,
    from: from ? new Date(from as string) : undefined,
    to: to ? new Date(to as string) : undefined,
    page: page ? parseInt(page as string) || 1 : 1,
    limit: limit ? parseInt(limit as string) || 50 : 50
  });

  sendSuccess(res, result);
};
