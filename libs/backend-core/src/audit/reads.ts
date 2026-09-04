import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuditEvent } from './AuditEvent';
import { actorOf, type Actor } from './actor';
import logger from '../logging/logger';

/**
 * Record what software read, and only what software read.
 *
 * A person browsing their own journal generates nothing here. That is not a
 * shortcut: one dashboard load hits half a dozen endpoints, so logging it would
 * bury the interesting rows under thousands of uninteresting ones and put a
 * database write behind every page view.
 *
 * What an assistant read is the part worth keeping, because it is the part that
 * left the server. A created entry leaves a record behind either way; a read
 * leaves nothing at all, and it is exactly what the privacy page warns about —
 * ask an assistant what you did last month and those entries go to whoever runs
 * it. This is the only place that becomes visible.
 */
/**
 * Arm the read trail for one request, if it is one worth recording.
 *
 * Nothing is written here — the listener fires when the response finishes, so a
 * refused request is not recorded as a read and the count reflects what was
 * actually sent.
 */
export function recordRead(req: Request, res: Response, actor: Actor, service: string): void {
  if (req.method !== 'GET' || actor.kind === 'person') return;

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    void AuditEvent.create({
      at: new Date(),
      service,
      action: 'read',
      resource: resourceOf(req.baseUrl + req.path),
      actorKind: actor.kind,
      userId: actor.userId,
      actorLabel: actor.label,
      actorCredentialId: actor.credentialId,
      tenant: actor.tenant,
      count: res.locals.auditCount as number | undefined
    }).catch((error) => {
      logger.warn('Could not record a read', { error: (error as Error)?.message });
    });
  });
}

/**
 * The same thing as standalone middleware, for anything that authenticates its
 * own way rather than through `authenticateAgent`.
 */
export const auditReads =
  (service: string): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const actor = actorOf(req);
    if (actor) recordRead(req, res, actor, service);
    next();
  };

/**
 * What a path was asking for, in one word.
 *
 * The first path segment, which is the collection on every route here —
 * `/api/activities/68d6…` is about activities. Deliberately crude: a trail
 * naming the resource is readable, and one naming the full path with ids in it
 * is a request log wearing an audit log's clothes.
 */
export function resourceOf(path: string): string {
  const segments = path.split('/').filter((segment) => segment && segment !== 'api');
  return segments[0]?.replace(/-/g, '_') ?? 'unknown';
}

/**
 * How many records a response carried.
 *
 * Set by a handler that knows; absent otherwise. The size of what left the
 * server is most of what makes a read worth recording — "read the journal" and
 * "read four hundred entries of the journal" are different events.
 */
export const countRead = (res: Response, count: number): void => {
  // Guarded for the same reason recording is fire-and-forget: instrumentation
  // must not be able to fail the thing it instruments. Express always provides
  // `locals`, but a handler called directly does not have to.
  if (!res?.locals) return;
  res.locals.auditCount = count;
};
