import mongoose from 'mongoose';

/**
 * One document per signed-in device, owned and written by auth-service; every
 * other service only reads it here. A session token names its document in the
 * `sid` claim, and the token is only as good as that document: deleting it
 * (sign-out, "sign out this device") ends the session on its next request, in
 * every service, and its `expiresAt` (slid forward by auth-service while the
 * device is in use, never past a hard cap from sign-in) is what idle expiry
 * actually means.
 */
export const USER_SESSIONS_COLLECTION = 'user_sessions';

/**
 * Tokens minted before sessions existed carry no `sid` and lived 24 hours.
 * auth-service upgrades one to a session the next time `/auth/verify` sees it,
 * so this window closes by itself a day after the sessions release; the branch
 * accepting them can be deleted after that.
 */
const LEGACY_TOKEN_MAX_LIFETIME_SECONDS = 24 * 60 * 60;

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** True for a pre-sessions token: no `sid`, and the old 24-hour lifetime at most. */
export function isLegacySessionlessToken(claims: unknown): boolean {
  if (!claims || typeof claims !== 'object') return false;
  const { sid, iat, exp } = claims as { sid?: unknown; iat?: unknown; exp?: unknown };
  return (
    sid === undefined &&
    Number.isSafeInteger(iat) &&
    Number.isSafeInteger(exp) &&
    (exp as number) - (iat as number) <= LEGACY_TOKEN_MAX_LIFETIME_SECONDS
  );
}

type SessionCheck = (claims: unknown) => Promise<boolean>;

/**
 * Whether a verified session token still stands: for a token with a `sid`,
 * its session belongs to the token's user and has neither been revoked nor
 * expired. Read on the primary, uncached, so a revocation holds from the next
 * request.
 */
const checkSessionInDatabase: SessionCheck = async (claims) => {
  if (!claims || typeof claims !== 'object') return false;
  const { id, sid } = claims as { id?: unknown; sid?: unknown };
  if (sid === undefined) return isLegacySessionlessToken(claims);
  if (typeof sid !== 'string' || !OBJECT_ID.test(sid)) return false;
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) return false;
  // Refuse rather than queue an authentication query while the database is down.
  if (mongoose.connection.readyState !== 1) return false;

  const session = await mongoose.connection.collection(USER_SESSIONS_COLLECTION).findOne(
    {
      _id: new mongoose.Types.ObjectId(sid),
      userId: new mongoose.Types.ObjectId(id),
      expiresAt: { $gt: new Date() }
    },
    { projection: { _id: 1 }, readPreference: 'primary', maxTimeMS: 3000 }
  );
  return session !== null;
};

let sessionCheck: SessionCheck = checkSessionInDatabase;

export const isCurrentSession = (claims: unknown): Promise<boolean> => sessionCheck(claims);

/**
 * Replaces the check, for tests only; pass nothing to restore the real one.
 * Not exported from the package index: service suites reach it through the
 * `@tumbaland/backend-core/testing` entry point (see testing.js).
 */
export function overrideSessionCheckForTests(check?: SessionCheck): void {
  sessionCheck = check ?? checkSessionInDatabase;
}
