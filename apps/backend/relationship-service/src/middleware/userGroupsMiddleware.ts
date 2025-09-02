import { Request, Response, NextFunction } from 'express';

export interface RequestWithGroups extends Request {
  user?: any;
  userGroups?: string[];
  groupServiceError?: string;
}

/**
 * Middleware to fetch user's group IDs and attach to request
 * Includes error handling and fallback behavior
 */
export const userGroupsMiddleware = async (
  req: RequestWithGroups,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip if no authenticated user
    if (!req.user?.email) {
      req.userGroups = [];
      return next();
    }

    const groupServiceUrl = process.env.GROUP_API_URL;
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    
    // Fallback if group service not configured
    if (!groupServiceUrl || !internalToken) {
      console.warn('Group service not configured, using user-only permissions');
      req.userGroups = [];
      req.groupServiceError = 'Group service not configured';
      return next();
    }

    // Fetch user groups with timeout and error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(`${groupServiceUrl}/api/groups/mine/ids?userEmail=${encodeURIComponent(req.user.email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': internalToken,
          'x-service-id': 'relationship-service'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Group service error: ${response.status} ${response.statusText}`);
        req.userGroups = [];
        req.groupServiceError = `Group service unavailable (${response.status})`;
        return next();
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('Group service returned error:', result.message);
        req.userGroups = [];
        req.groupServiceError = result.message || 'Group service error';
        return next();
      }

      req.userGroups = result.data || [];
      console.log(`✅ Fetched ${req.userGroups?.length || 0} groups for user ${req.user.email}`);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Group service request timeout');
        req.groupServiceError = 'Group service timeout';
      } else {
        console.error('Group service fetch error:', fetchError.message);
        req.groupServiceError = 'Group service connection failed';
      }
      
      req.userGroups = [];
    }

    next();
  } catch (error) {
    console.error('User groups middleware error:', error);
    req.userGroups = [];
    req.groupServiceError = 'Middleware error';
    next(); // Continue with fallback permissions
  }
};

// Legacy export for backwards compatibility
export const attachUserGroups = userGroupsMiddleware;
