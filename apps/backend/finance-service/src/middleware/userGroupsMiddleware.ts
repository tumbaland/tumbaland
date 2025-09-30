import { Request, Response, NextFunction } from 'express';

export interface RequestWithGroups extends Request {
  user?: any;
  userGroups?: string[];
}

/**
 * Middleware to extract user's group IDs from JWT token
 * Groups are now embedded in the JWT token by the auth service
 */
export const userGroupsMiddleware = async (
  req: RequestWithGroups,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract groups from JWT token (now embedded by auth service)
    const user = req.user;
    if (user?.groups && Array.isArray(user.groups)) {
      req.userGroups = user.groups;
      console.log(`✅ Extracted ${req.userGroups?.length || 0} groups from JWT for user ${user.email}`);
    } else {
      req.userGroups = [];
      console.log(`ℹ️ No groups found in JWT for user ${user?.email || 'unknown'}`);
    }

    next();
  } catch (error) {
    console.error('User groups middleware error:', error);
    req.userGroups = [];
    next(); // Continue with empty groups
  }
};

// Legacy export for backwards compatibility
export const attachUserGroups = userGroupsMiddleware;
