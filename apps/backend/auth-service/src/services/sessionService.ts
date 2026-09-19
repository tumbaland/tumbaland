import { Request, Response } from 'express';
import { logger, UnauthorizedError } from '@tumbaland/backend-core';
import { generateJWT, UserPayload } from './jwtService';
import { deviceFamily } from './userAgent';
import { IUser, User } from '../models/User';
import { ISession, Session, SignInMethod } from '../models/Session';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A session ends after this long unused. Sliding: every renewal (`/auth/verify`,
 * run each time an app opens) pushes it on.
 */
export const SESSION_IDLE_TTL_MS = 30 * DAY_MS;

/**
 * However active a session is, it ends this long after sign-in, so a stolen
 * cookie cannot keep itself alive by being used.
 */
export const SESSION_MAX_AGE_MS = 90 * DAY_MS;

/**
 * Renewal writes at most this often per session: opening the shell runs several
 * verifies at once, and "last active" needs no finer grain.
 */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Where the refresh cookie lived before sessions; cleared wherever it turns up. */
const LEGACY_REFRESH_COOKIE_PATH = '/auth';

const cookieDomain = (): string => process.env.COOKIE_DOMAIN || 'localhost';

/** The cookie lasts as long as the session's idle expiry; renewal re-sets it. */
const sessionCookieOptions = (session: Pick<ISession, 'expiresAt'>) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  domain: cookieDomain(),
  path: '/',
  maxAge: Math.max(0, session.expiresAt.getTime() - Date.now())
});

export const clearSessionCookies = (res: Response): void => {
  res.clearCookie('access_token', { domain: cookieDomain(), path: '/' });
  res.clearCookie('refresh_token', { path: LEGACY_REFRESH_COOKIE_PATH });
};

/**
 * Group memberships for the JWT's `groups` claim, which every service
 * authorizes group-scoped requests against.
 *
 * `fallback` is what to claim when group-service cannot be reached. Returning
 * an empty list there is not a safe default: it mints a token that looks valid
 * and 403s every group-scoped request, and the user has no way to tell that
 * from having lost access. Callers that already hold a verified token pass its
 * existing claim, so a blip re-issues what the user already had.
 */
export const getUserGroups = async (email: string, fallback: string[] = []): Promise<string[]> => {
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

interface SessionIdentity {
  name?: string;
  picture?: string;
}

const userAgentOf = (req: Request): string | undefined => {
  const userAgent = req.headers?.['user-agent'];
  return typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined;
};

/** Set by Cloudflare in front of auth-api; `XX` and `T1` (Tor) say nothing useful. */
const countryOf = (req: Request): string | undefined => {
  const country = req.headers?.['cf-ipcountry'];
  return typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1'
    ? country
    : undefined;
};

/** Signs the token for `session`, with fresh groups and roles, and sets the cookie. */
async function mintSessionToken(
  res: Response,
  session: ISession,
  user: { id: string; email: string; tokenVersion?: number; groups?: string[] },
  identity: SessionIdentity
): Promise<UserPayload> {
  const [groups, roles] = await Promise.all([getUserGroups(user.email, user.groups), getUserRoles(user.email)]);
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    name: identity.name ?? '',
    ...(identity.picture ? { picture: identity.picture } : {}),
    groups,
    roles,
    tokenVersion: user.tokenVersion || 1,
    sid: session._id.toString()
  };
  res.cookie('access_token', generateJWT(payload, session.absoluteExpiresAt), sessionCookieOptions(session));
  // The refresh cookie belongs to the pre-sessions scheme; a session replaces it.
  res.clearCookie('refresh_token', { path: LEGACY_REFRESH_COOKIE_PATH });
  return payload;
}

async function createSession(req: Request, userId: string, method: SignInMethod): Promise<ISession> {
  const now = Date.now();
  return Session.create({
    userId,
    method,
    userAgent: userAgentOf(req),
    country: countryOf(req),
    lastSeenAt: new Date(now),
    expiresAt: new Date(now + SESSION_IDLE_TTL_MS),
    absoluteExpiresAt: new Date(now + SESSION_MAX_AGE_MS)
  });
}

/**
 * Signs a person in on this device: a new session, its token and the cookie.
 * Always a fresh session, never one the browser already held, so a session
 * planted on someone before they signed in is never the one they get.
 */
export const startSession = async (
  req: Request,
  res: Response,
  dbUser: IUser,
  method: SignInMethod,
  identity: SessionIdentity = {}
): Promise<UserPayload> => {
  const session = await createSession(req, dbUser._id.toString(), method);
  logger.info('Session started', { userId: dbUser._id.toString(), sessionId: session._id.toString(), method });
  return mintSessionToken(
    res,
    session,
    { id: dbUser._id.toString(), email: dbUser.email, tokenVersion: dbUser.tokenVersion },
    identity
  );
};

/**
 * Renews the caller's session (`/auth/verify`, `/auth/refresh`): slides its
 * idle expiry, re-signs the token with fresh groups and roles, re-sets the
 * cookie. A pre-sessions token (or refresh cookie) has no session to renew, so
 * it is given one, which is how those migrate without anyone being signed out.
 *
 * A session that turns up on a different kind of device than it started on is
 * ended instead: the cookie was copied. Only the operating-system family is
 * compared (see deviceFamily), so an iPhone asking for the desktop site is not
 * mistaken for a stranger's laptop.
 */
export const renewSession = async (req: Request, res: Response): Promise<UserPayload> => {
  const user = req.user as UserPayload;
  let session = req.authSession ?? (await createSession(req, user.id, 'unknown'));

  const startedOn = deviceFamily(session.userAgent);
  const seenOn = deviceFamily(userAgentOf(req));
  if (startedOn && seenOn && startedOn !== seenOn) {
    await Session.deleteOne({ _id: session._id });
    logger.warn('Session ended: used from a different kind of device than it started on', {
      userId: user.id,
      sessionId: session._id.toString(),
      startedOn,
      seenOn,
      country: countryOf(req)
    });
    clearSessionCookies(res);
    throw new UnauthorizedError('Session has ended');
  }

  const now = Date.now();
  if (session.lastSeenAt.getTime() <= now - SESSION_TOUCH_INTERVAL_MS) {
    const expiresAt = new Date(Math.min(now + SESSION_IDLE_TTL_MS, session.absoluteExpiresAt.getTime()));
    const touched = await Session.findOneAndUpdate(
      { _id: session._id, userId: session.userId },
      { $set: { lastSeenAt: new Date(now), expiresAt, ...(countryOf(req) ? { country: countryOf(req) } : {}) } },
      { returnDocument: 'after' }
    );
    // Revoked between the middleware's check and here: renew nothing.
    if (!touched) throw new UnauthorizedError('Session has ended');
    session = touched;
  }

  return mintSessionToken(
    res,
    session,
    { id: user.id, email: user.email, tokenVersion: user.tokenVersion, groups: user.groups },
    { name: user.name, picture: user.picture }
  );
};

/** Ends one of the person's sessions. False when there was no such session of theirs. */
export const revokeSession = async (userId: string, sessionId: string): Promise<boolean> => {
  const { deletedCount } = await Session.deleteOne({ _id: sessionId, userId });
  return deletedCount > 0;
};

/** Ends every session of the person's except `keepSessionId` (all of them when absent). */
export const revokeOtherSessions = async (userId: string, keepSessionId?: string): Promise<number> => {
  const { deletedCount } = await Session.deleteMany({
    userId,
    ...(keepSessionId ? { _id: { $ne: keepSessionId } } : {})
  });
  return deletedCount;
};

/** The person's live sessions, most recently active first. */
export const listSessions = async (userId: string): Promise<ISession[]> =>
  Session.find({ userId, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 });
