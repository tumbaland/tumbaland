import * as jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import { requireEnv } from '@tumbaland/backend-core';

// tokenVersion revocation (POST /auth/internal/invalidate-tokens) is only enforced
// by auth-service's own auth middleware — every other service just verifies the JWT
// signature/expiry and has no way to know a token was revoked early, so this expiry
// bounds that exposure window. The frontend re-verifies (and silently re-mints a
// fresh cookie via /auth/verify) on a 5-minute cache, so active sessions never
// notice. A session idle longer than this is renewed from the refresh cookie
// below rather than sent back to sign in: expiring after a day of not opening
// the app meant anyone who visits occasionally signed in on nearly every visit.
const JWT_EXPIRES_IN = '24h';

/**
 * How long someone stays signed in without opening the app.
 *
 * Rolling: every /auth/verify reissues it, so only 90 days of not visiting
 * signs a person out. The access token above stays short; this one only buys a
 * new access token from auth-service, which checks tokenVersion on the way, so
 * revocation still takes effect at the next renewal.
 */
const REFRESH_EXPIRES_IN = '90d';
export const REFRESH_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles?: string[];
  isApproved?: boolean;
  groups?: string[];
  tokenVersion?: number;
}

export const generateJWT = (user: UserPayload): string => {
  const JWT_SECRET = requireEnv('JWT_SECRET');
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyJWT = (token: string): UserPayload => {
  const JWT_SECRET = requireEnv('JWT_SECRET');
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Refresh tokens are signed with a key derived from JWT_SECRET rather than the
 * secret itself. Every other service verifies access tokens with JWT_SECRET, so
 * a refresh token that leaked into one of them would otherwise pass there as a
 * 90-day access token. Derived, so there is no second secret to deploy.
 */
const refreshSecret = (): string =>
  createHmac('sha256', requireEnv('JWT_SECRET')).update('tumbaland:refresh-token').digest('hex');

/** Only who the person is. Groups and roles are looked up fresh at renewal. */
export const generateRefreshToken = (user: UserPayload): string => {
  const { id, email, name, picture, tokenVersion } = user;
  return jwt.sign({ id, email, name, picture, tokenVersion, typ: 'refresh' }, refreshSecret(), {
    expiresIn: REFRESH_EXPIRES_IN
  });
};

export const verifyRefreshToken = (token: string): UserPayload => {
  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(token, refreshSecret()) as jwt.JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
  if (claims.typ !== 'refresh') {
    throw new Error('Invalid or expired refresh token');
  }
  return {
    id: claims.id,
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
    tokenVersion: claims.tokenVersion
  };
};

export const decodeJWT = (token: string): UserPayload | null => {
  try {
    return jwt.decode(token) as UserPayload;
  } catch (error) {
    return null;
  }
};
