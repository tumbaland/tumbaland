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
