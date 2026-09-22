import { Request, Response, NextFunction } from 'express';
import { BadRequestError, logger, NotFoundError, UnauthorizedError } from '@tumbaland/backend-core';
import { verifyGoogleToken } from '../services/googleAuthService';
import { UserPayload } from '../services/jwtService';
import { clearSessionCookies, renewSession, startSession } from '../services/sessionService';
import { User } from '../models/User';
import { effectivePicture } from '../services/avatarService';
import { Session, SignInMethod } from '../models/Session';

/**
 * Verifies a Google ID token, creates or updates the user, and sets the session
 * cookies. Shared by the JSON endpoint and the redirect-mode callback.
 */
const signInWithGoogle = async (req: Request, res: Response, idToken: string) => {
  const googleUser = await verifyGoogleToken(idToken);

  if (!googleUser) {
    throw new UnauthorizedError('Invalid Google token');
  }

  return signIn(req, res, googleUser, 'google');
};

interface GoogleIdentity {
  email?: string;
  name?: string;
  picture?: string;
}

/** Creates or updates the user and starts a session on this device. */
const signIn = async (req: Request, res: Response, googleUser: GoogleIdentity, method: SignInMethod) => {
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
      // Stored, not just put in the token, so a renewal can fall back to it
      // after someone removes a picture they uploaded.
      $set: { lastLoginAt: new Date(), googlePicture: googleUser.picture ?? null }
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
    // One they uploaded wins over Google's, which would otherwise replace it
    // at every sign-in.
    picture: effectivePicture(dbUser),
    tokenVersion: dbUser.tokenVersion || 1
  };

  await startSession(req, res, dbUser, method, { name: userPayload.name, picture: userPayload.picture });

  return { userPayload, approved: dbUser.isApproved };
};

export const validateToken = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const { userPayload, approved } = await signInWithGoogle(req, res, req.body.idToken);

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

/**
 * Google's redirect-mode sign-in (`ux_mode: 'redirect'`): Google posts the ID
 * token here as a form, and we answer with the session cookie and a redirect
 * back into the app.
 *
 * The nonce ties the token to the browser that started the sign-in: auth-front
 * gives it to Google, which puts it in the token, and also stores it in a
 * cookie. Someone else's token posted here carries a different nonce, which
 * stops login CSRF.
 */
export const googleRedirectCallback = async (req: Request, res: Response): Promise<void> => {
  const redirectTarget = safeRedirectTarget(req.cookies?.[LOGIN_REDIRECT_COOKIE]);
  const nonce = req.cookies?.[LOGIN_NONCE_COOKIE];

  const clearOptions = { domain: process.env.COOKIE_DOMAIN || 'localhost', path: LOGIN_COOKIE_PATH };
  res.clearCookie(LOGIN_NONCE_COOKIE, clearOptions);
  res.clearCookie(LOGIN_REDIRECT_COOKIE, clearOptions);

  const credential = req.body?.credential;
  try {
    if (typeof credential !== 'string' || !credential || typeof nonce !== 'string' || !nonce) {
      throw new BadRequestError('Missing credential or sign-in nonce');
    }

    const googleUser = await verifyGoogleToken(credential);
    if (!googleUser) {
      throw new UnauthorizedError('Invalid Google token');
    }
    if (googleUser.nonce !== nonce) {
      throw new UnauthorizedError('Sign-in nonce does not match');
    }

    await signIn(req, res, googleUser, 'google');
  } catch (error) {
    logger.warn('Google redirect sign-in failed', {
      error: (error as Error)?.message,
      hadNonceCookie: Boolean(nonce)
    });
    const retry = new URL(authFrontUrl());
    retry.searchParams.set('error', 'signin_failed');
    retry.searchParams.set('redirect_uri', redirectTarget);
    res.redirect(303, retry.toString());
    return;
  }

  res.redirect(303, redirectTarget);
};

/** Ends this device's session, so its token stops working everywhere, not just here. */
export const logout = async (req: Request, res: Response): Promise<void> => {
  if (req.authSession) {
    await Session.deleteOne({ _id: req.authSession._id });
  }
  clearSessionCookies(res);
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

  // The sessions are dead from here anyway (every renewal checks the version);
  // removing them keeps the devices list honest.
  await Session.deleteMany({ userId: user._id });

  logger.info('Invalidated tokens for user', { email, tokenVersion: user.tokenVersion });

  res.json({
    success: true,
    message: 'User tokens invalidated successfully',
    newTokenVersion: user.tokenVersion
  });
};

export const verifyAuth = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.email) {
    throw new UnauthorizedError('No authenticated user');
  }

  const payload = await renewSession(req, res);

  res.json({
    success: true,
    authenticated: true,
    user: payload
  });
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.email) {
    throw new UnauthorizedError('No authenticated user');
  }

  // An explicit request for a new token, so always a new one.
  await renewSession(req, res, { reissue: true });

  res.json({ success: true });
};
