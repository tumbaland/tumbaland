import { Request } from 'express';
import logger from '../logging/logger';
import { SubjectResolver } from '../entitlements/middleware';
import { getGroupOwner } from './client';

export type GroupIdResolver = (req: Request) => string | undefined | Promise<string | undefined>;

/**
 * Builds the `subject` resolver that `requireQuota` / `requireEntitlement`
 * already accept, for the meters whose resource can live in a group.
 *
 * ```ts
 * requireQuota('storageBytes', {
 *   subject: groupOwnerSubject(req => req.body.groupId),
 *   amount: req => req.body.sizeBytes
 * })
 * ```
 *
 * Personal rows keep billing to the caller; group rows bill to the group's
 * owner, because Family sells *pooled* storage and seats and the uploader's own
 * free tier is not the pool.
 *
 * **When the owner cannot be resolved, it bills the caller and says so.** The
 * alternative — refusing the write — is harsher than what the entitlement
 * client itself does for the same class of outage (it degrades to free limits
 * rather than denying), and the error direction here is bounded in the shape
 * that matters: the common case is a member on a cheap personal plan uploading
 * into a group owned by someone on Family, so falling back to the caller checks
 * against the *smaller* allowance. It can over-grant when the caller happens to
 * hold the richer plan, which is why it logs at `error` — a run of these means
 * group-service is down, not that a limit is wrong.
 */
export function groupOwnerSubject(resolveGroupId: GroupIdResolver): SubjectResolver {
  return async (req: Request) => {
    const caller = req.user?.email;
    const groupId = await resolveGroupId(req);
    if (!groupId) return caller;

    const owner = await getGroupOwner(String(groupId));
    if (owner) return owner.ownerEmail;

    logger.error('Group owner unresolved; billing usage to the caller instead', {
      event: 'entitlement.subject_fallback',
      groupId: String(groupId),
      caller,
      route: req.originalUrl
    });
    return caller;
  };
}
