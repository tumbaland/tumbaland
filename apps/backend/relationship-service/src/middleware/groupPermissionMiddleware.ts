import { Request, Response, NextFunction } from 'express';

export interface GroupPermissionResult {
  hasAccess: boolean;
  role?: string;
  error?: string;
}

/**
 * Check if a user has access to a specific group
 */
export async function checkGroupPermission(
  groupId: string, 
  userEmail: string
): Promise<GroupPermissionResult> {
  try {
    const GROUP_SERVICE_URL = process.env.GROUP_SERVICE_URL || '';
    
    const response = await fetch(
      `${GROUP_SERVICE_URL}/api/groups/${groupId}/membership`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`,
          'X-User-Email': userEmail
        }
      }
    );

    if (!response.ok) {
      return { hasAccess: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.success && data.member) {
      return {
        hasAccess: true,
        role: data.role
      };
    }

    return { hasAccess: false };
  } catch (error: any) {
    console.error('Error checking group permission:', error);
    return { 
      hasAccess: false, 
      error: error.message 
    };
  }
}

/**
 * Middleware to require group membership for accessing resources
 */
export function requireGroupAccess(getGroupId: (req: Request) => string | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.email) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const groupId = getGroupId(req);
      if (!groupId) {
        // No group specified, allow access for user's own data
        next();
        return;
      }

      const permission = await checkGroupPermission(groupId, user.email);
      if (!permission.hasAccess) {
        res.status(403).json({ 
          success: false, 
          message: 'Access denied: Not a member of this group' 
        });
        return;
      }

      // Add group role to request for further authorization if needed
      (req as any).groupRole = permission.role;
      next();
    } catch (error) {
      console.error('Group permission middleware error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal error checking group permissions' 
      });
    }
  };
}

/**
 * Check if user can access resource based on ownership or group membership
 */
export async function canAccessResource(
  userId: string,
  userEmail: string,
  resourceUserId: string,
  resourceGroupId?: string
): Promise<boolean> {
  // Owner can always access their own resources
  if (userId === resourceUserId) {
    return true;
  }

  // If resource is associated with a group, check group membership
  if (resourceGroupId) {
    const permission = await checkGroupPermission(resourceGroupId, userEmail);
    return permission.hasAccess;
  }

  // No group association and not owner - no access
  return false;
}
