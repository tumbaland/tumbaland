import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError, logger, NotFoundError, UnauthorizedError } from '@tumbaland/backend-core';
import { verifyGoogleToken } from '../services/googleAuthService';
import { generateJWT, generateRefreshToken, REFRESH_TOKEN_MAX_AGE_MS, UserPayload } from '../services/jwtService';
import { User } from '../models/User';
import { PendingSignIn } from '../models/PendingSignIn';

const REFRESH_COOKIE_PATH = '/auth';

/**
 * The access token, shared across every *.tumbaland.eu service, plus the
 * refresh token that renews it (see authenticateSession).
 *
 * The refresh cookie is host-only and limited to /auth, so the browser sends
 * it to auth-service's session routes and nowhere else. It is reissued with
 * every access token, which is what makes its 90 days count from the last
 * visit rather than from sign-in.
 */
const setSessionCookies = (res: Response, accessToken: string, user: UserPayload): void => {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  res.cookie('refresh_token', generateRefreshToken(user), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS
  });
};

/**
 * Verifies a Google ID token, creates or updates the user, and sets the session
 * cookies. Shared by the JSON endpoint and the redirect-mode callback.
 */
const signInWithGoogle = async (res: Response, idToken: string) => {
  const googleUser = await verifyGoogleToken(idToken);

  if (!googleUser) {
    throw new UnauthorizedError('Invalid Google token');
  }

  return startSession(res, googleUser);
};

interface GoogleIdentity {
  email?: string;
  name?: string;
  picture?: string;
}

/** Creates or updates the user and sets the session cookies. */
const startSession = async (res: Response, googleUser: GoogleIdentity) => {
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

  setSessionCookies(res, jwtToken, jwtPayload);

  return { userPayload, approved: dbUser.isApproved };
};

export const validateToken = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const { userPayload, approved } = await signInWithGoogle(res, req.body.idToken);

  res.json({
    success: true,
    user: userPayload,
    approved
  });
};

/** Cookies auth-front sets just before sending the person to Google. */
const LOGIN_NONCE_COOKIE = 'login_nonce';
const LOGIN_REDIRECT_COOKIE = 'login_redirect';
const LOGIN_COOKIE_PATH = '/auth/google';

const authFrontUrl = (): string =>
  (process.env.AUTH_FRONT_URL || 'https://auth.tumbaland.eu').replace(/\/$/, '');

/**
 * Where to send the person once they are signed in. Only our own sites are
 * allowed, so the callback cannot be used to bounce someone to another domain.
 */
export const safeRedirectTarget = (target: unknown): string => {
  const fallback = authFrontUrl();
  if (typeof target !== 'string' || !target) return fallback;

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return fallback;
  }

  const domain = process.env.COOKIE_DOMAIN || 'localhost';
  const onOurDomain = url.hostname === domain || url.hostname.endsWith(`.${domain}`);
  const schemeOk = url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost');
  return onOurDomain && schemeOk ? url.toString() : fallback;
};

/** How long a sign-in finished in another window waits to be collected. */
const PENDING_SIGNIN_TTL_MS = 5 * 60 * 1000;
/** Wrong codes allowed before the pending sign-in is thrown away. */
const PENDING_SIGNIN_MAX_ATTEMPTS = 5;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const sameHash = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Google's redirect-mode sign-in (`ux_mode: 'redirect'`): Google posts the ID
 * token here as a form, and we answer with a redirect.
 *
 * The nonce ties the token to the browser that started the sign-in: auth-front
 * gives it to Google, which puts it in the token, and also stores it in a
 * cookie. When that cookie comes back we are in the same browser, so the
 * session is set right here.
 *
 * On an iPhone home-screen app it does not come back: Google's page opens in a
 * Safari sheet with its own cookies. Setting the session here would put it in
 * the sheet, not the app. So the sign-in is parked (see PendingSignIn) and the
 * sheet shows a code that the person types into the app to collect it.
 */
export const googleRedirectCallback = async (req: Request, res: Response): Promise<void> => {
  const redirectTarget = safeRedirectTarget(req.cookies?.[LOGIN_REDIRECT_COOKIE]);
  const nonceCookie = req.cookies?.[LOGIN_NONCE_COOKIE];

  const clearOptions = { domain: process.env.COOKIE_DOMAIN || 'localhost', path: LOGIN_COOKIE_PATH };
  res.clearCookie(LOGIN_NONCE_COOKIE, clearOptions);
  res.clearCookie(LOGIN_REDIRECT_COOKIE, clearOptions);

  const credential = req.body?.credential;
  try {
    if (typeof credential !== 'string' || !credential) {
      throw new BadRequestError('Missing credential');
    }

    const googleUser = await verifyGoogleToken(credential);
    if (!googleUser?.email) {
      throw new UnauthorizedError('Invalid Google token');
    }
    if (typeof googleUser.nonce !== 'string' || !googleUser.nonce) {
      throw new UnauthorizedError('Google token has no nonce');
    }

    if (typeof nonceCookie === 'string' && nonceCookie) {
      if (nonceCookie !== googleUser.nonce) {
        throw new UnauthorizedError('Sign-in nonce does not match');
      }
      await startSession(res, googleUser);
      res.redirect(303, redirectTarget);
      return;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await PendingSignIn.findOneAndUpdate(
      { nonceHash: sha256(googleUser.nonce) },
      {
        $set: {
          codeHash: sha256(code),
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          failedAttempts: 0,
          expiresAt: new Date(Date.now() + PENDING_SIGNIN_TTL_MS)
        }
      },
      { upsert: true }
    );
    logger.info('Google sign-in finished in another window; waiting for the app to collect it', {
      email: googleUser.email
    });

    const pending = new URL(authFrontUrl());
    pending.searchParams.set('signin', 'pending');
    pending.searchParams.set('code', code);
    res.redirect(303, pending.toString());
  } catch (error) {
    logger.warn('Google redirect sign-in failed', {
      error: (error as Error)?.message,
      hadNonceCookie: Boolean(nonceCookie)
    });
    const retry = new URL(authFrontUrl());
    retry.searchParams.set('error', 'signin_failed');
    retry.searchParams.set('redirect_uri', redirectTarget);
    res.redirect(303, retry.toString());
  }
};

/**
 * Collects a sign-in parked by googleRedirectCallback.
 *
 * Without a code it only says whether one is waiting, so the login page knows
 * to ask for the code. With the code it sets the session cookies, in the
 * browser that made this request, which is the app.
 */
export const claimPendingSignIn = async (req: Request, res: Response): Promise<void> => {
  const { nonce, code } = req.body as { nonce: string; code?: string };
  const nonceHash = sha256(nonce);

  const pending = await PendingSignIn.findOne({ nonceHash, expiresAt: { $gt: new Date() } });
  if (!pending) {
    res.json({ success: true, status: 'none' });
    return;
  }

  if (code === undefined) {
    res.json({ success: true, status: 'code_required' });
    return;
  }

  if (!sameHash(sha256(code), pending.codeHash)) {
    const updated = await PendingSignIn.findOneAndUpdate(
      { nonceHash },
      { $inc: { failedAttempts: 1 } },
      { new: true }
    );
    if (!updated || updated.failedAttempts >= PENDING_SIGNIN_MAX_ATTEMPTS) {
      await PendingSignIn.deleteOne({ nonceHash });
      throw new UnauthorizedError('Too many wrong codes. Please sign in again.');
    }
    throw new UnauthorizedError('That code is not right. Please check it and try again.');
  }

  // Delete first, so the same sign-in cannot be collected twice.
  const claimed = await PendingSignIn.findOneAndDelete({ nonceHash, codeHash: pending.codeHash });
  if (!claimed) {
    res.json({ success: true, status: 'none' });
    return;
  }

  await startSession(res, { email: claimed.email, name: claimed.name, picture: claimed.picture });
  res.json({ success: true, status: 'signed_in' });
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie('access_token', {
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/'
  });
  res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
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

  setSessionCookies(res, newToken, jwtPayload);

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

  setSessionCookies(res, newToken, jwtPayload);

  res.json({
    success: true,
    groups: userGroups
  });
};
