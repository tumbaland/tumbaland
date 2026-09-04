import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env';
import { isApiKeyScope, type ApiKeyScope } from '../apiKeys/types';

/**
 * Access tokens for the OAuth flow that lets an assistant connect to Tumbaland.
 *
 * These are JWTs rather than database rows so the MCP server can validate one
 * without a query on every tool call, and because OAuth expects short-lived
 * bearer tokens with a refresh path rather than the indefinite credentials an
 * API key is. The trade is that a token cannot be revoked before it expires —
 * hence the deliberately short life, with revocation applied at the refresh
 * token, which is the thing that actually persists.
 */

/** Marks a token as issued by the OAuth flow, for the MCP resource specifically. */
export const ACCESS_TOKEN_TYPE = 'mcp_access';

/** Short enough that a leaked token is a small window, long enough to be usable. */
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

export interface AccessTokenClaims {
  /** the user the assistant is acting for */
  sub: string;
  /** the MCP server this token may be used against — RFC 8707 audience binding */
  aud: string;
  iss: string;
  scope: string;
  /** the tenant the token is pinned to; null means the user's personal data */
  groupId: string | null;
  email: string;
  name: string;
  typ: typeof ACCESS_TOKEN_TYPE;
  jti: string;
  exp: number;
  iat: number;
}

export interface MintAccessTokenInput {
  userId: string;
  email: string;
  name: string;
  /** the canonical URI of the MCP server the token is for */
  resource: string;
  issuer: string;
  scopes: ApiKeyScope[];
  groupId: string | null;
}

export interface MintedAccessToken {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

export const mintAccessToken = (input: MintAccessTokenInput): MintedAccessToken => {
  const scope = input.scopes.join(' ');

  const accessToken = jwt.sign(
    {
      sub: input.userId,
      aud: input.resource,
      iss: input.issuer,
      scope,
      groupId: input.groupId,
      email: input.email,
      name: input.name,
      typ: ACCESS_TOKEN_TYPE,
      jti: randomUUID()
    },
    requireEnv('JWT_SECRET'),
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );

  return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, scope };
};

export interface AccessTokenVerification {
  ok: boolean;
  rejection?: 'malformed' | 'expired' | 'wrong-audience' | 'wrong-type' | 'bad-signature';
  userId?: string;
  email?: string;
  name?: string;
  scopes?: ApiKeyScope[];
  groupId?: string | null;
}

/**
 * Check a bearer token presented to the MCP server.
 *
 * Two checks beyond the signature carry real weight. The audience must match
 * this server: a token minted for one resource must not work against another,
 * which is what RFC 8707 binding is for and what stops a token obtained for
 * somewhere else being replayed here. And the type must be `mcp_access`, so an
 * ordinary session JWT — same secret, same issuer, but no scopes and no tenant
 * pin — cannot be presented as an access token and quietly get everything.
 */
export const verifyAccessToken = (
  token: string,
  expectedAudience: string
): AccessTokenVerification => {
  let claims: AccessTokenClaims;
  try {
    claims = jwt.verify(token, requireEnv('JWT_SECRET')) as AccessTokenClaims;
  } catch (error) {
    const expired = (error as Error)?.name === 'TokenExpiredError';
    return { ok: false, rejection: expired ? 'expired' : 'bad-signature' };
  }

  if (!isAccessTokenClaims(claims)) return { ok: false, rejection: 'wrong-type' };
  if (claims.aud !== expectedAudience) return { ok: false, rejection: 'wrong-audience' };
  if (!claims.sub) return { ok: false, rejection: 'malformed' };

  return {
    ok: true,
    userId: claims.sub,
    email: claims.email ?? '',
    name: claims.name ?? '',
    scopes: (claims.scope ?? '').split(' ').filter(isApiKeyScope),
    groupId: claims.groupId ?? null
  };
};

/**
 * Tell an OAuth access token apart from an ordinary session JWT.
 *
 * They are signed with the same secret and arrive in the same header, so
 * anything holding one has to ask which it got. Getting this wrong is not a
 * subtle failure: read as a session, an access token has no `id` and no
 * `groups`, so `req.user.id` lands as `undefined` and every scoped query goes
 * out unbounded.
 */
export const isAccessTokenClaims = (claims: unknown): claims is AccessTokenClaims =>
  typeof claims === 'object' &&
  claims !== null &&
  (claims as AccessTokenClaims).typ === ACCESS_TOKEN_TYPE;

/** Parse a space-separated `scope` parameter, dropping anything we do not define. */
export const parseScopes = (scope: unknown): ApiKeyScope[] =>
  typeof scope === 'string' ? scope.split(/\s+/).filter(isApiKeyScope) : [];
