import { ForbiddenError } from '../errors/HttpError';

/** Whether `groupId` is one of the groups the person belongs to. */
export const isMemberOf = (groupId: string, userGroups: readonly string[] | null | undefined): boolean =>
  Boolean(userGroups?.includes(groupId));

/**
 * The one rule that keeps a group's data inside the group: a `groupId` that
 * arrives in a request is never trusted, it must be one of the caller's own.
 *
 * No group named means the caller's personal data, which is always theirs, so
 * `undefined` and `null` pass. A group they are not in throws a 403, never
 * falls back to personal: reading someone else's group as "personal" would
 * quietly show them nothing, and writing to it would not.
 */
export function assertMemberOf(
  groupId: string | null | undefined,
  userGroups: readonly string[] | null | undefined,
  message = 'Access denied'
): void {
  if (groupId && !isMemberOf(groupId, userGroups)) throw new ForbiddenError(message);
}
