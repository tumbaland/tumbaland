import { Request } from 'express';
import { ForbiddenError } from '@tumbaland/backend-core';

/**
 * The tenancy filter every finance read uses: either the caller's personal
 * documents (theirs, with no group) or the documents belonging to the group
 * they are currently working in. The two are deliberately exclusive — the
 * finance UI shows one context at a time, so mixing personal and group figures
 * into one total would misreport net worth.
 */
export function tenantScope(userId: string, userGroups: string[] = []): Record<string, unknown> {
  if (userGroups.length === 0) {
    return { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };
  }
  return { groupId: { $in: userGroups } };
}

/** The same filter expressed from a single optional groupId. */
export function scopeFor(userId: string, groupId?: string): Record<string, unknown> {
  return tenantScope(userId, groupId ? [groupId] : []);
}

/**
 * The group a request works in, or undefined for the caller's personal data.
 * Read from `?groupId=` unless the caller passes the value to check. A group
 * the caller is not a member of is refused, never read as personal.
 */
export function contextGroupId(req: Request, groupId: unknown = req.query.groupId): string | undefined {
  if (!groupId) return undefined;
  if (typeof groupId !== 'string' || !(req.userGroups || []).includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }
  return groupId;
}

/** `contextGroupId` as the list `tenantScope` takes. */
export function contextGroups(req: Request): string[] {
  const groupId = contextGroupId(req);
  return groupId ? [groupId] : [];
}
