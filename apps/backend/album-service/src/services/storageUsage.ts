import { Request } from 'express';
import {
  checkQuota,
  getEntitlements,
  getGroupOwner,
  logger,
  recordUsage,
  releaseQuota
} from '@tumbaland/backend-core';

/**
 * The `storageBytes` chokepoint (MONETIZATION.md, Phase 3 #1).
 *
 * **Why the gate is on the signed-URL request and the meter moves at
 * `createPhoto`.** The signed URL is the only point where a file's size is
 * known *before* its bytes are written; `createPhoto` runs after the client has
 * already put the object in MinIO, so refusing there would mean paying the
 * storage cost and then declining to record it. The two halves are therefore
 * different primitives: `checkQuota` at the gate, which records nothing, and
 * `recordUsage` at creation, which records without re-checking. A user who
 * squeezes past the ceiling by racing two uploads keeps both files and is
 * refused the third — the limit stops new writes, it does not un-store bytes.
 *
 * **Why this is a service and not `requireQuota` middleware.** The billing
 * subject depends on the *album*, which the route does not have: a group album
 * bills to the group's owner, because Family sells 250 GB *pooled* and the
 * uploader's own free gigabyte is not the pool. Every album in the live
 * database is group-owned, so this is the common path, not an edge case.
 *
 * Deletes hand the bytes back here too — a cumulative meter that only counts up
 * is a bug that surfaces as an angry support email six months in.
 */

const METER = 'storageBytes' as const;

/** Who a write bills to, assembled from the request. */
export interface StorageActor {
  /** The meter's `subjectId` is an email, never `req.user.id`. */
  email?: string;
  /** `req.user.id` — what `Album.userId` holds. */
  userId: string;
  /** Attached to the `entitlement.blocked` log so a 402 traces back to a route. */
  route?: string;
}

/** The part of an album that decides who its bytes are billed to. */
export interface StorageScope {
  userId?: string;
  groupId?: string;
}

interface StorageSubject {
  /** The email the meter is kept under. */
  subject: string;
  /**
   * False when the subject was inferred rather than resolved — an unreachable
   * group-service, or a personal album belonging to someone other than the
   * caller. Checks still run against it; writes to the meter do not.
   */
  resolved: boolean;
}

export function storageActor(req: Request): StorageActor {
  return {
    email: req.user?.email,
    userId: req.user?.id ?? '',
    route: req.originalUrl
  };
}

/**
 * Whose allowance an album's bytes come out of.
 *
 * A group album bills to the group's owner; a personal album bills to its own
 * user, who behind `authenticateToken` is the caller. The two unresolved cases
 * are deliberately *not* symmetrical with each other in what they permit:
 *
 * - **Group owner unreachable.** Bills the caller and logs at `error`, matching
 *   `groupOwnerSubject`: refusing the write would be harsher than what the
 *   entitlement client does for the same outage (it degrades to free limits
 *   rather than denying), and the common case — a member on a cheap plan
 *   uploading into a Family group — then checks against the *smaller*
 *   allowance.
 * - **Personal album, different user.** The album's owner has an email this
 *   service cannot look up (`Album.userId` is an auth-service id and the meter
 *   is keyed by email), so the check falls back to the caller's own allowance,
 *   which is the conservative direction.
 *
 * Both are marked unresolved, and the meter is only *written* when the subject
 * is resolved: crediting or charging the wrong account is worse than a counter
 * that lags, because `storageBytes` is derived and the nightly reconciliation
 * re-derives it from the photos themselves.
 */
async function storageSubject(actor: StorageActor, scope: StorageScope): Promise<StorageSubject | null> {
  const caller = actor.email?.trim().toLowerCase();

  if (scope.groupId) {
    const owner = await getGroupOwner(String(scope.groupId)).catch(() => null);
    if (owner?.ownerEmail) return { subject: owner.ownerEmail, resolved: true };

    logger.error('Group owner unresolved; billing album storage to the caller instead', {
      event: 'entitlement.subject_fallback',
      groupId: String(scope.groupId),
      caller,
      route: actor.route
    });
    return caller ? { subject: caller, resolved: false } : null;
  }

  if (!caller) {
    // Behind `authenticateToken` this cannot happen; if it ever does, metering
    // a write to nobody is worse than not metering it, so say so loudly.
    logger.error('Album storage write has no billable subject', {
      event: 'entitlement.subject_missing',
      userId: actor.userId,
      route: actor.route
    });
    return null;
  }

  if (scope.userId && String(scope.userId) !== actor.userId) {
    logger.warn('Personal album belongs to another user; checking storage against the caller', {
      event: 'entitlement.subject_fallback',
      albumUserId: String(scope.userId),
      caller,
      route: actor.route
    });
    return { subject: caller, resolved: false };
  }

  return { subject: caller, resolved: true };
}

/**
 * Refuse an upload that would not fit, before a byte is written.
 *
 * Throws `PaymentRequiredError` (402) naming the meter, the ceiling and the
 * plan that lifts it. Racy by construction — two concurrent requests can both
 * pass — which is acceptable precisely because storage is reconciled from the
 * photos each night.
 */
export async function assertStorageHeadroom(
  actor: StorageActor,
  scope: StorageScope,
  sizeBytes: number
): Promise<void> {
  const billing = await storageSubject(actor, scope);
  if (!billing) return;

  const entitlements = await getEntitlements(billing.subject);
  await checkQuota({
    subjectId: billing.subject,
    meter: METER,
    amount: Math.max(0, Math.floor(sizeBytes)),
    entitlements,
    route: actor.route
  });
}

/** Count bytes that are now stored. Call after the photo record exists. */
export async function recordStoredBytes(
  actor: StorageActor,
  scope: StorageScope,
  bytes: number
): Promise<void> {
  if (!(bytes > 0)) return;

  const billing = await storageSubject(actor, scope);
  if (!billing?.resolved) return;

  await recordUsage(billing.subject, METER, Math.floor(bytes));
}

/** Hand bytes back once they are gone. Call after the delete has landed. */
export async function releaseStoredBytes(
  actor: StorageActor,
  scope: StorageScope,
  bytes: number
): Promise<void> {
  if (!(bytes > 0)) return;

  const billing = await storageSubject(actor, scope);
  if (!billing?.resolved) return;

  await releaseQuota(billing.subject, METER, Math.floor(bytes));
}

/**
 * Move an album's bytes between meters when it changes group.
 *
 * Moving a 40 GB album into a Family group shifts who pays for it, and until
 * the nightly reconciliation ran, both meters would be wrong — the old subject
 * still charged for bytes they no longer hold, the new one under-charged for
 * bytes they do. Deliberately *not* gated: the album already exists, and a
 * refused move would strand it, so the receiving subject can go over and is
 * refused their next upload instead.
 */
export async function transferStoredBytes(
  actor: StorageActor,
  from: StorageScope,
  to: StorageScope,
  bytes: number
): Promise<void> {
  if (!(bytes > 0)) return;
  if ((from.groupId ?? null) === (to.groupId ?? null)) return;

  await releaseStoredBytes(actor, from, bytes);
  await recordStoredBytes(actor, to, bytes);
}
