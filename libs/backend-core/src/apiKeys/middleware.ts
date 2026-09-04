import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env';
import logger from '../logging/logger';
import { isAccessTokenClaims, type AccessTokenClaims } from '../oauth/tokens';
import type { UserPayload } from '../types/auth';
import { looksLikeApiKey } from './crypto';
import { verifyApiKey } from './service';
import {
  PERSONAL_TENANT,
  groupIdsOf,
  isApiKeyScope,
  readTenants,
  type ApiKeyScope,
  type ApiKeyTenant,
  type Tenant
} from './types';

/**
 * Request-scoped facts about the key a request arrived on. Absent on ordinary
 * session requests, which is itself the signal a handler needs: `req.apiKey`
 * being set means software is acting, not a person.
 */
export interface ApiKeyContext {
  keyId: string;
  scopes: ApiKeyScope[];
  /** every tenant this credential may act in, and the one it acts in by default */
  tenants: ApiKeyTenant;
  /** the tenant this particular request resolved to */
  actingAs: Tenant;
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext;
    }
  }
}

/** Both auth paths read the token from the same two places. */
const extractToken = (req: Request): string | undefined =>
  req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

const unauthorized = (res: Response): void => {
  res.status(401).json({ success: false, message: 'Invalid or expired credentials' });
};

/**
 * The tenant a request is asking to act in, wherever it named one.
 *
 * Handlers read `groupId` from either the query string or the body depending on
 * the verb, so both are checked — a rule that only covered one of them would be
 * no rule at all. A caller names the personal tenant with the literal
 * `personal`, since "no group" is what the resolved default gets written into
 * and would otherwise be indistinguishable from not having asked.
 */
const requestedTenant = (req: Request): Tenant | undefined => {
  const fromQuery = req.query?.groupId;
  if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;

  const fromBody = (req.body as Record<string, unknown> | undefined)?.groupId;
  if (typeof fromBody === 'string' && fromBody.length > 0) return fromBody;

  return undefined;
};

/** Express 5 makes `req.query` a getter, so it is redefined rather than assigned. */
const setQueryGroupId = (req: Request, groupId: string | undefined): void => {
  const query = { ...req.query } as Record<string, unknown>;
  if (groupId === undefined) delete query.groupId;
  else query.groupId = groupId;

  Object.defineProperty(req, 'query', {
    value: query,
    writable: true,
    configurable: true,
    enumerable: true
  });
};

/**
 * Hold a credential to the tenants it was granted, and settle which one this
 * request is acting in.
 *
 * A request naming a tenant outside the grant is refused outright — that
 * boundary is the whole reason a credential is safe to hand to an agent, and it
 * is unchanged by the grant being a set rather than one. What the set adds is a
 * choice *inside* it, which is what lets one connection reach a shared journal
 * and a private photo library without reconnecting.
 *
 * A request that names nothing gets the default written in for it, so an agent
 * granted a single tenant never has to know a group id exists and a handler's
 * `if (groupId) … else personal` branch lands where the owner intended.
 */
const applyTenantGrant = (req: Request, tenants: ApiKeyTenant): Tenant | null => {
  const requested = requestedTenant(req) ?? tenants.default;

  if (!tenants.allowed.includes(requested)) return null;

  // Resolved either way, including when the caller asked for exactly what the
  // default already was: handlers read the personal tenant as an absent
  // `groupId`, so `personal` has to be erased rather than passed through.
  const groupId = requested === PERSONAL_TENANT ? undefined : requested;
  setQueryGroupId(req, groupId);
  if (req.body && typeof req.body === 'object') {
    if (groupId === undefined) delete (req.body as Record<string, unknown>).groupId;
    else (req.body as Record<string, unknown>).groupId = groupId;
  }

  return requested;
};

/** A verified non-session credential, whichever kind it arrived as. */
interface AgentCredential {
  /** the key id or token id, for the request-scoped context */
  credentialId: string;
  userId: string;
  email: string;
  name: string;
  scopes: ApiKeyScope[];
  tenants: ApiKeyTenant;
}

/**
 * Admit software acting for a user, on the terms its credential carries.
 *
 * Shared by both non-session credentials on purpose. An API key and an OAuth
 * access token differ entirely in how they are issued and verified, and not at
 * all in what they mean once they are: a user, a set of scopes, and one tenant.
 * Settling that in one place is what keeps the two from drifting into subtly
 * different amounts of access.
 */
function admitAgent(
  req: Request,
  res: Response,
  next: NextFunction,
  requiredScopes: ApiKeyScope[],
  credential: AgentCredential
): void {
  const missing = requiredScopes.filter((scope) => !credential.scopes.includes(scope));
  if (missing.length > 0) {
    res.status(403).json({
      success: false,
      message: `Credential is missing required scope: ${missing.join(', ')}`
    });
    return;
  }

  const actingAs = applyTenantGrant(req, credential.tenants);
  if (actingAs === null) {
    res.status(403).json({
      success: false,
      message: 'Credential is not permitted to act in the requested group'
    });
    return;
  }

  req.user = { id: credential.userId, email: credential.email, name: credential.name };
  // Only the granted groups, never the owner's full membership: this is what
  // stops a credential reaching a group it was not issued for through any
  // handler that consults `userGroups` instead of the `groupId` parameter.
  req.userGroups = groupIdsOf(credential.tenants.allowed);
  req.apiKey = {
    keyId: credential.credentialId,
    scopes: credential.scopes,
    tenants: credential.tenants,
    actingAs
  };

  next();
}

/**
 * Authenticate a request that software may legitimately be making.
 *
 * Accepts either an ordinary session — a person at a keyboard, who keeps the
 * full run of their own account — or an API key carrying every one of
 * `requiredScopes`.
 *
 * This is deliberately *not* what `authenticateToken` became. Keys stay refused
 * everywhere by default, and a route opts in by naming the scopes it needs; the
 * alternative, teaching the existing middleware about keys, would have silently
 * opened every route in every service at once, account deletion included.
 */
export const authenticateAgent = (...requiredScopes: ApiKeyScope[]): RequestHandler =>
  async function authenticateAgentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }

    if (!looksLikeApiKey(token)) {
      let claims: UserPayload | AccessTokenClaims;
      try {
        claims = jwt.verify(token, requireEnv('JWT_SECRET')) as UserPayload | AccessTokenClaims;
      } catch {
        unauthorized(res);
        return;
      }

      if (!isAccessTokenClaims(claims)) {
        const user = claims as UserPayload;
        req.user = user;
        req.userGroups = user.groups ?? [];
        next();
        return;
      }

      // An OAuth access token: signed with the same secret as a session and
      // arriving in the same header, but nothing like one. It names its user in
      // `sub`, carries scopes, and is pinned to a tenant — so it is admitted
      // the way a key is, not the way a person is.
      //
      // Reading it as a session was the original bug and it failed quietly: the
      // claims have no `id` and no `groups`, so `req.user.id` arrived as
      // `undefined`, scoped writes were refused as inaccessible, and a read
      // whose scope collapsed to nothing fell through to "no user context" and
      // answered from the whole collection.
      admitAgent(req, res, next, requiredScopes, {
        credentialId: claims.jti,
        userId: claims.sub,
        email: claims.email ?? '',
        name: claims.name ?? '',
        scopes: (claims.scope ?? '').split(' ').filter(isApiKeyScope),
        tenants: readTenants(claims)
      });
      return;
    }

    const result = await verifyApiKey(token);
    if (!result.ok) {
      // The client is told only that the credentials failed; which of the five
      // ways it failed is a detail that would help someone guessing.
      logger.warn('API key rejected', { rejection: result.rejection, path: req.path });
      unauthorized(res);
      return;
    }

    admitAgent(req, res, next, requiredScopes, {
      credentialId: result.keyId!,
      userId: result.userId!,
      email: result.userEmail ?? '',
      name: result.userName ?? '',
      scopes: result.scopes ?? [],
      tenants: result.tenants ?? readTenants({})
    });
  };

/**
 * Require a scope on a route already behind `authenticateAgent`.
 *
 * Splitting authentication from authorization lets one `router.use` cover a
 * whole router while each route still states what it needs — so a read-only key
 * reaches the GETs and stops at the POSTs, instead of being turned away at the
 * door for lacking a scope half the router never uses.
 *
 * A session passes unconditionally: scopes narrow what software may do on a
 * person's behalf, not what the person may do themselves. Everything that is
 * not a session — an API key or an OAuth access token alike — arrives with
 * `req.apiKey` set and is held to it.
 */
export const requireScope = (...requiredScopes: ApiKeyScope[]): RequestHandler =>
  function requireScopeHandler(req, res, next) {
    if (!req.apiKey) {
      next();
      return;
    }

    const missing = requiredScopes.filter((scope) => !req.apiKey!.scopes.includes(scope));
    if (missing.length > 0) {
      res.status(403).json({
        success: false,
        message: `Credential is missing required scope: ${missing.join(', ')}`
      });
      return;
    }

    next();
  };

/**
 * Refuse every non-session credential on a route that a session may still use.
 *
 * For the handful of operations that should stay a person's to perform — key
 * management itself, most obviously, since a key that can mint keys is a key
 * that cannot be revoked.
 */
export const denyApiKeys: RequestHandler = (req, res, next) => {
  if (req.apiKey) {
    res.status(403).json({
      success: false,
      message: 'This operation requires an interactive session, not an API key'
    });
    return;
  }
  next();
};
