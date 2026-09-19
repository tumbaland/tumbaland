import * as jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import { requireEnv } from '@tumbaland/backend-core';

/**
 * Lifetime of a token minted without a session: only tests and the legacy
 * migration path do that now. A session token instead expires with its
 * session's hard cap (see sessionService), and every service checks the
 * session on each request, so signing a device out takes effect at once.
 */
const JWT_EXPIRES_IN = '24h';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles?: string[];
  isApproved?: boolean;
  groups?: string[];
  tokenVersion?: number;
  /** The session (user_sessions) this token belongs to. */
  sid?: string;
}

export const generateJWT = (user: UserPayload, expiresAt?: Date): string => {
  const JWT_SECRET = requireEnv('JWT_SECRET');
  if (expiresAt) {
    return jwt.sign({ ...user, exp: Math.floor(expiresAt.getTime() / 1000) }, JWT_SECRET);
  }
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
 * Refresh tokens came before sessions: a 90-day `refresh_token` cookie that
 * bought new access tokens. None are issued any more. One still in a browser is
 * accepted once by authenticateSession, which turns it into a session, so
 * nobody was signed out by the change. Delete this and verifyRefreshToken 90
 * days after the sessions release.
 *
 * Signed with a key derived from JWT_SECRET, so a refresh token that leaked
 * into another service never passed there as an access token.
 */
const refreshSecret = (): string =>
  createHmac('sha256', requireEnv('JWT_SECRET')).update('tumbaland:refresh-token').digest('hex');

/** Only for testing the migration path; nothing issues refresh tokens now. */
export const generateRefreshToken = (user: UserPayload): string => {
  const { id, email, name, picture, tokenVersion } = user;
  return jwt.sign({ id, email, name, picture, tokenVersion, typ: 'refresh' }, refreshSecret(), { expiresIn: '90d' });
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
