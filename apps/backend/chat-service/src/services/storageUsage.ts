import { checkQuota, getEntitlements, getGroupOwner, logger, recordUsage, releaseQuota } from '@tumbaland/backend-core';
import type { Caller } from './accessService';

/**
 * The `storageBytes` chokepoint for chat attachments.
 *
 * The same two-part shape album-service uses, and for the same reason: the
 * signed-URL request is the only point where a file's size is known *before*
 * its bytes are written, while the message that owns those bytes does not
 * exist until afterwards. So the gate (`assertHeadroom`, which records nothing)
 * and the meter (`recordStoredBytes`, which records without re-checking) are
 * different calls at different moments.
 *
 * Simpler than album's in one way: a conversation always belongs to a group, so
 * the subject is always the group's owner. There is no personal-scope fallback
 * to get wrong.
 */

const METER = 'storageBytes' as const;

/**
 * Whose allowance a conversation's bytes come out of.
 *
 * Returns null when group-service cannot be reached, which is treated as
 * "do not meter" rather than "do not allow": refusing the upload would be
 * harsher than what the entitlements client does for the same outage, and
 * `storageBytes` is reconciled nightly from the stored files anyway. Charging
 * the wrong account is worse than a counter that lags.
 */
async function subjectFor(groupId: string, route?: string): Promise<string | null> {
  const owner = await getGroupOwner(groupId).catch(() => null);
  if (owner?.ownerEmail) return owner.ownerEmail;

  logger.error('Group owner unresolved; chat attachment bytes not metered', {
    event: 'entitlement.subject_missing',
    groupId,
    route
  });
  return null;
}

/**
 * Refuse an upload that would not fit, before a byte is written.
 *
 * Throws `PaymentRequiredError` (402) naming the meter, the ceiling and the
 * plan that lifts it. Racy by construction: two uploads started at once can
 * both pass, which is acceptable because the limit stops new writes rather
 * than un-storing bytes, and the nightly reconciliation re-derives the total.
 */
export async function assertHeadroom(person: Caller, groupId: string, sizeBytes: number): Promise<void> {
  const subject = await subjectFor(groupId, person.email);
  if (!subject) return;

  const entitlements = await getEntitlements(subject);
  await checkQuota({
    subjectId: subject,
    meter: METER,
    amount: Math.max(0, Math.floor(sizeBytes)),
    entitlements,
    route: 'chat.attachment.upload-url'
  });
}

/** Count bytes that are now stored. Called once the message exists. */
export async function recordStoredBytes(groupId: string, bytes: number): Promise<void> {
  if (!(bytes > 0)) return;

  const subject = await subjectFor(groupId);
  if (!subject) return;

  await recordUsage(subject, METER, Math.floor(bytes));
}

/**
 * Hand bytes back once they are gone.
 *
 * A cumulative meter that only counts up is a bug that surfaces months later
 * as someone locked out of storage they freed in the spring.
 */
export async function releaseStoredBytes(groupId: string, bytes: number): Promise<void> {
  if (!(bytes > 0)) return;

  const subject = await subjectFor(groupId);
  if (!subject) return;

  await releaseQuota(subject, METER, Math.floor(bytes));
}
