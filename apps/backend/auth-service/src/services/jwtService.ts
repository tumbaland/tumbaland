import * as jwt from 'jsonwebtoken';
import { requireEnv } from '@tumbaland/backend-core';

// tokenVersion revocation (POST /auth/internal/invalidate-tokens) is only enforced
// by auth-service's own auth middleware — every other service just verifies the JWT
// signature/expiry and has no way to know a token was revoked early, so this expiry
// bounds that exposure window. The frontend re-verifies (and silently re-mints a
// fresh cookie via /auth/verify) on a 5-minute cache, so active sessions never
// notice; only sessions idle longer than this need to re-authenticate. Previously
// 30m, which forced re-logins on any tab left idle for half an hour; widened to a
// full day to match typical session/cookie expectations, still under the 7-day
// cookie lifetime that bounds the revocation exposure window.
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

export const decodeJWT = (token: string): UserPayload | null => {
  try {
    return jwt.decode(token) as UserPayload;
  } catch (error) {
    return null;
  }
};
