/**
 * Simple permission helper that builds query filters for group-based access
 * This avoids external API calls and can be used in database queries directly
 */

/**
 * Build a MongoDB query for resources accessible by a user
 * @param userId - The user's ID
 * @param groupIds - Array of group IDs the user belongs to (optional)
 * @param includePublic - Whether to include public resources
 */
export function buildAccessQuery(
  userId: string,
  groupIds: string[] = [],
  includePublic: boolean = false
) {
  const conditions: Array<
    { userId: string } | { groupId: { $in: string[] } } | { isPublic: boolean }
  > = [
    { userId } // User's own resources
  ];

  // Add group-based access
  if (groupIds.length > 0) {
    conditions.push({ groupId: { $in: groupIds } });
  }

  // Add public resources if requested
  if (includePublic) {
    conditions.push({ isPublic: true });
  }

  return { $or: conditions };
}

/**
 * Check if a user can access a specific resource
 * @param userId - The requesting user's ID
 * @param resourceUserId - The resource owner's ID
 * @param resourceGroupId - The resource's group ID (if any)
 * @param userGroupIds - Array of group IDs the user belongs to
 * @param isResourcePublic - Whether the resource is public
 */
export function canAccessResource(
  userId: string,
  resourceUserId: string,
  resourceGroupId?: string,
  userGroupIds: string[] = [],
  isResourcePublic: boolean = false
): boolean {
  // Owner can always access their own resources
  if (userId === resourceUserId) {
    return true;
  }

  // Public resources are accessible to anyone
  if (isResourcePublic) {
    return true;
  }

  // If resource is associated with a group, check if user is in that group
  if (resourceGroupId && userGroupIds.includes(resourceGroupId)) {
    return true;
  }

  // No access
  return false;
}
