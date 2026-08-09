import { Request, Response, NextFunction } from 'express';
import { BadRequestError, logger, NotFoundError, UnauthorizedError } from '@tumbaland/backend-core';
import { verifyGoogleToken } from '../services/googleAuthService';
import { generateJWT, UserPayload } from '../services/jwtService';
import { User } from '../models/User';

export const validateToken = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const { idToken } = req.body;
  const googleUser = await verifyGoogleToken(idToken);

  if (!googleUser) {
    throw new UnauthorizedError('Invalid Google token');
  }

  const userEmail = googleUser.email || '';
  if (!userEmail) {
    throw new BadRequestError('Email not present in Google token');
  }

  // Upsert DB user (automatic approval for new users)
  const dbUser = await User.findOneAndUpdate(
    { email: userEmail.toLowerCase() },
    {
      $setOnInsert: {
        email: userEmail.toLowerCase(),
        signupMethod: 'google',
        isApproved: true
      },
      $set: { lastLoginAt: new Date() }
    },
    { new: true, upsert: true }
  );

  if (!dbUser) {
    throw new Error('Failed to create or find user');
  }

  // Update userPayload to use database user ID instead of Google sub
  const userPayload: UserPayload = {
    id: dbUser._id.toString(), // Use MongoDB _id instead of Google sub
    email: googleUser.email || '',
    name: googleUser.name || '',
    picture: googleUser.picture,
    tokenVersion: dbUser.tokenVersion || 1
  };

  // Fetch user groups and include in JWT payload
  const userGroups = await getUserGroups(userPayload.email);

  // Include groups and roles in the JWT payload
  const jwtPayload: UserPayload = {
    ...userPayload,
    groups: userGroups,
    roles: dbUser.roles
  };

  const jwtToken = generateJWT(jwtPayload);

  // Set secure cookie for SSO across subdomains
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res.cookie('access_token', jwtToken, cookieOptions);

  res.json({
    success: true,
    user: userPayload,
    approved: dbUser.isApproved
  });
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie('access_token', {
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

export const invalidateUserTokens = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  // Increment token version to invalidate all existing tokens for this user
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $inc: { tokenVersion: 1 } },
    { new: true }
  );

  if (!user) {
    throw new NotFoundError('User not found');
  }

  logger.info('Invalidated tokens for user', { email, tokenVersion: user.tokenVersion });

  res.json({
    success: true,
    message: 'User tokens invalidated successfully',
    newTokenVersion: user.tokenVersion
  });
};

/**
 * Group memberships for the JWT's `groups` claim, which every service
 * authorizes group-scoped requests against.
 *
 * `fallback` is what to claim when group-service cannot be reached. Returning
 * an empty list there is not a safe default: it mints a token that looks
 * valid for seven days and 403s every group-scoped request, and the user has
 * no way to tell that from having lost access. Callers that already hold a
 * verified token pass its existing claim, so a blip re-issues what the user
 * already had instead of silently stripping it.
 */
const getUserGroups = async (email: string, fallback: string[] = []): Promise<string[]> => {
  // Fetch fresh data from group service
  try {
    const groupServiceUrl = process.env.GROUP_API_URL;
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

    if (!groupServiceUrl || !internalToken) {
      logger.error('Cannot resolve group claim: GROUP_API_URL or INTERNAL_SERVICE_TOKEN is unset', { email });
      return fallback;
    }

    const groupResponse = await fetch(`${groupServiceUrl}/api/groups/mine/ids?userEmail=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
        'x-service-id': 'auth-service'
      },
      signal: AbortSignal.timeout(3000)
    });

    if (!groupResponse.ok) {
      logger.error('Group service rejected the group claim lookup', { email, status: groupResponse.status });
      return fallback;
    }

    const groupResult = await groupResponse.json();
    if (!groupResult.success) {
      logger.error('Group service reported failure for the group claim lookup', { email });
      return fallback;
    }

    return groupResult.data || [];
  } catch (error) {
    logger.error('Failed to fetch user groups for JWT', { email, error: (error as Error)?.message });
    return fallback;
  }
};

const getUserRoles = async (email: string): Promise<string[]> => {
  const dbUser = await User.findOne({ email: email.toLowerCase() });
  return dbUser?.roles || [];
};

export const verifyAuth = async (req: Request, res: Response): Promise<void> => {
  const currentUser = req.user as UserPayload;
  if (!currentUser?.email) {
    throw new UnauthorizedError('No authenticated user');
  }

  // Fetch fresh user groups and roles, keeping the claim we already issued if
  // group-service is unreachable rather than handing back a token with none.
  const [userGroups, userRoles] = await Promise.all([
    getUserGroups(currentUser.email, currentUser.groups),
    getUserRoles(currentUser.email)
  ]);

  // Generate new JWT with fresh groups/roles
  const jwtPayload: UserPayload = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    picture: currentUser.picture,
    groups: userGroups,
    roles: userRoles,
    tokenVersion: currentUser.tokenVersion || 1
  };

  const newToken = generateJWT(jwtPayload);

  // Update cookie with fresh token
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res.cookie('access_token', newToken, cookieOptions);

  logger.info('Generated new token for user', { email: currentUser.email, groupCount: userGroups.length });

  res.json({
    success: true,
    authenticated: true,
    user: jwtPayload
  });
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  // Get current user from JWT
  const currentUser = req.user as UserPayload;
  if (!currentUser?.email) {
    throw new UnauthorizedError('No authenticated user');
  }

  // Fetch fresh user groups and roles, keeping the claim we already issued if
  // group-service is unreachable rather than handing back a token with none.
  const [userGroups, userRoles] = await Promise.all([
    getUserGroups(currentUser.email, currentUser.groups),
    getUserRoles(currentUser.email)
  ]);

  // Generate new JWT with updated groups/roles
  const jwtPayload: UserPayload = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    picture: currentUser.picture,
    groups: userGroups,
    roles: userRoles,
    tokenVersion: currentUser.tokenVersion || 1
  };

  const newToken = generateJWT(jwtPayload);

  // Update cookie
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res.cookie('access_token', newToken, cookieOptions);

  res.json({
    success: true,
    groups: userGroups
  });
};
