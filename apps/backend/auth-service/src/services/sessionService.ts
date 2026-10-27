import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { logger, UnauthorizedError } from '@tumbaland/backend-core';
import { generateJWT, UserPayload } from './jwtService';
import { deviceFamily } from './userAgent';
import { effectivePicture } from './avatarService';
import { effectiveName } from './nameService';
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

/**
 * How old a token gets before /auth/verify signs a new one. Younger than this,
 * verify only answers who the caller is: every app runs it when it opens, often
 * several at once, and re-signing each time meant a new cookie per call and
 * parallel writers racing each other. It is also how stale the token's roles
 * can get.
 */
export const TOKEN_REISSUE_AFTER_MS = 15 * 60 * 1000;

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
export const countryOf = (req: Request): string | undefined => {
  const country = req.headers?.['cf-ipcountry'];
  return typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1'
    ? country
    : undefined;
};

/**
 * Signs the token for `session`, with fresh roles, and sets the cookie.
 *
 * No `groups` claim: every service asks group-service for membership (see
 * currentGroupsOf in backend-core), so a change applies within seconds instead
 * of waiting for the token to be re-signed.
 */
async function mintSessionToken(
  res: Response,
  session: ISession,
  user: { id: string; email: string; tokenVersion?: number },
  identity: SessionIdentity
): Promise<UserPayload> {
  const roles = await getUserRoles(user.email);
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    name: identity.name ?? '',
    ...(identity.picture ? { picture: identity.picture } : {}),
    roles,
    tokenVersion: user.tokenVersion || 1,
    sid: session._id.toString()
  };
  res.cookie('access_token', generateJWT(payload, session.absoluteExpiresAt), sessionCookieOptions(session));
  logger.info('Issued session token', { userId: user.id, sessionId: payload.sid });
  // The refresh cookie belongs to the pre-sessions scheme; a session replaces it.
  res.clearCookie('refresh_token', { path: LEGACY_REFRESH_COOKIE_PATH });
  return payload;
}

const newSessionFields = (req: Request, userId: string, method: SignInMethod) => {
  const now = Date.now();
  return {
    userId,
    method,
    userAgent: userAgentOf(req),
    country: countryOf(req),
    lastSeenAt: new Date(now),
    expiresAt: new Date(now + SESSION_IDLE_TTL_MS),
    absoluteExpiresAt: new Date(now + SESSION_MAX_AGE_MS)
  };
};

async function createSession(req: Request, userId: string, method: SignInMethod): Promise<ISession> {
  return Session.create(newSessionFields(req, userId, method));
}

const isDuplicateKey = (error: unknown): boolean => (error as { code?: number })?.code === 11000;

/**
 * The session for a pre-sessions login, created the first time it is renewed.
 *
 * An app opening runs several /auth/verify calls at once, all carrying the same
 * old cookies. Keyed on a hash of those cookies, they all get one session
 * rather than one each; creating a session per call left orphans that showed
 * up as the same device listed several times.
 */
async function sessionForLegacyLogin(req: Request, userId: string): Promise<ISession> {
  const credentials = [req.cookies?.access_token, req.cookies?.refresh_token, req.headers?.authorization]
    .map((value) => (typeof value === 'string' ? value : ''))
    .join('|');
  const legacyKey = createHash('sha256').update(credentials).digest('hex');
  const filter = { legacyKey, userId };
  try {
    const session = await Session.findOneAndUpdate(
      filter,
      { $setOnInsert: { ...newSessionFields(req, userId, 'unknown'), legacyKey } },
      { upsert: true, returnDocument: 'after' }
    );
    if (session) return session;
  } catch (error) {
    // Two upserts raced and the other one inserted: use its session.
    if (!isDuplicateKey(error)) throw error;
  }
  const existing = await Session.findOne(filter);
  if (!existing) throw new UnauthorizedError('Session has ended');
  return existing;
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

/** The caller's token claims as the response describes them, without the JWT's own timestamps. */
const claimsOf = (user: UserPayload): UserPayload => {
  const { iat: _iat, exp: _exp, ...claims } = user as UserPayload & { iat?: number; exp?: number };
  return claims;
};

/**
 * Renews the caller's session (`/auth/verify`, `/auth/refresh`): slides its
 * idle expiry and, once the token is older than TOKEN_REISSUE_AFTER_MS (or
 * always, with `reissue`), re-signs it with fresh roles and re-sets the cookie. A pre-sessions token (or refresh cookie) has no session to renew, so
 * it is given one, which is how those migrate without anyone being signed out.
 *
 * A session that turns up on a different kind of device than it started on is
 * ended instead: the cookie was copied. Only the operating-system family is
 * compared (see deviceFamily), so an iPhone asking for the desktop site is not
 * mistaken for a stranger's laptop.
 */
export const renewSession = async (
  req: Request,
  res: Response,
  { reissue = false }: { reissue?: boolean } = {}
): Promise<UserPayload> => {
  const user = req.user as UserPayload;
  let session = req.authSession ?? (await sessionForLegacyLogin(req, user.id));

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

  // A pre-sessions login has no session in its token yet, so it always gets a new one.
  const issuedAt = (user as UserPayload & { iat?: number }).iat;
  const tokenIsFresh =
    req.authSession !== undefined && typeof issuedAt === 'number' && now - issuedAt * 1000 < TOKEN_REISSUE_AFTER_MS;
  if (!reissue && tokenIsFresh) {
    return claimsOf(user);
  }

  // The picture and name are read fresh rather than copied from the old token,
  // so a change made on another device reaches this one at its next renewal.
  // Only on this path, which runs a few times an hour at most, not on every request.
  const stored = await User.findById(user.id).select('picture googlePicture firstName lastName googleName');
  return mintSessionToken(
    res,
    session,
    { id: user.id, email: user.email, tokenVersion: user.tokenVersion },
    {
      name: (stored && effectiveName(stored)) ?? user.name,
      picture: (stored && effectivePicture(stored)) ?? inheritedPicture(user.picture)
    }
  );
};

/**
 * The old token's picture, when the database has none to offer.
 *
 * Someone who last signed in before Google pictures were stored has theirs
 * only in the token, so it is carried over. An uploaded one is not: if the
 * database no longer has it, it was removed, and its URL now answers 404.
 */
const inheritedPicture = (picture: string | undefined): string | undefined =>
  picture && !picture.includes('/auth/avatars/') ? picture : undefined;

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
