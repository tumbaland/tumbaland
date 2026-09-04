import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import {
  BadRequestError,
  findClient,
  isRegisteredRedirect,
  issueAuthorizationCode,
  issueRefreshToken,
  logger,
  mintAccessToken,
  parseScopes,
  redeemAuthorizationCode,
  redeemRefreshToken,
  registerClient,
  listConnections,
  revokeRefreshTokensForUser,
  NotFoundError,
  sendSuccess,
  requireEnv,
  API_KEY_SCOPES
} from '@tumbaland/backend-core';
import type { ApiKeyScope } from '@tumbaland/backend-core';

/**
 * OAuth 2.1 authorization server, for assistants connecting over MCP.
 *
 * Lives in auth-service because it already owns identity: the user is
 * authenticated here by the same Google session the web app uses, so consent is
 * something they give while signed in rather than a second set of credentials.
 */

const issuer = (): string =>
  (process.env.AUTH_SERVICE_PUBLIC_URL || 'https://auth-api.tumbaland.eu').replace(/\/$/, '');

/** The one resource this server issues tokens for. */
const mcpResource = (): string =>
  (process.env.MCP_PUBLIC_URL || 'https://mcp.tumbaland.eu').replace(/\/$/, '');

const authFrontUrl = (): string =>
  (process.env.AUTH_FRONT_URL || 'https://auth.tumbaland.eu').replace(/\/$/, '');

/**
 * RFC 8414 metadata: how a client discovers where to send the user and where to
 * exchange the code. Served unauthenticated at the issuer's root, because it is
 * the first thing a client reads and it reveals nothing.
 */
export const authorizationServerMetadata = (_req: Request, res: Response): void => {
  const base = issuer();

  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    scopes_supported: API_KEY_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 only: OAuth 2.1 removes `plain`, and a public client without PKCE is
    // an intercepted code away from being impersonated.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    authorization_response_iss_parameter_supported: true
  });
};

/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Open, and deliberately so: assistants register themselves, and there is no
 * plausible flow where a human pre-provisions Claude, ChatGPT and Gemini by
 * hand. Registration grants nothing on its own — a client id only lets you ask
 * a user for consent, and the user is who decides.
 */
export const registerOAuthClient = async (req: Request, res: Response): Promise<void> => {
  const { client_name: clientName, redirect_uris: redirectUris } = req.body as {
    client_name?: string;
    redirect_uris?: unknown;
  };

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    throw new BadRequestError('redirect_uris is required');
  }

  const uris = redirectUris.map(String);
  for (const uri of uris) {
    // http is allowed only for loopback, which is how local MCP clients and the
    // inspector call back; anything else on the public internet must be https.
    const isLoopback = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(uri);
    if (!uri.startsWith('https://') && !isLoopback) {
      throw new BadRequestError(`redirect_uri must be https or loopback: ${uri}`);
    }
  }

  const client = await registerClient({ clientName: clientName || 'Unnamed client', redirectUris: uris });
  logger.info('OAuth client registered', { clientId: client.clientId, clientName: client.clientName });

  res.status(201).json({
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code']
  });
};

interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state?: string;
  scopes: ApiKeyScope[];
  resource: string;
  codeChallenge: string;
}

/**
 * Validate an authorization request before anything is shown to the user.
 *
 * Errors split in two, and the split matters. A bad `client_id` or
 * `redirect_uri` must be shown to the *user*, never redirected — bouncing to an
 * unverified URI is how an open redirect is built. Everything else is the
 * client's fault and goes back to the (now verified) redirect URI as an error.
 */
async function validateAuthorizeRequest(req: Request): Promise<AuthorizeParams> {
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource,
    scope,
    state
  } = req.query as Record<string, string | undefined>;

  if (!clientId) throw new BadRequestError('client_id is required');
  if (!redirectUri) throw new BadRequestError('redirect_uri is required');

  const client = await findClient(clientId);
  if (!client) throw new BadRequestError('Unknown client_id');
  if (!isRegisteredRedirect(client, redirectUri)) {
    throw new BadRequestError('redirect_uri does not match the one registered for this client');
  }

  if (responseType !== 'code') throw new BadRequestError('response_type must be "code"');
  if (!codeChallenge) throw new BadRequestError('code_challenge is required');
  if (codeChallengeMethod !== 'S256') throw new BadRequestError('code_challenge_method must be S256');

  // RFC 8707: the token is bound to whatever is named here, so it has to be a
  // resource this server actually issues for.
  if (!resource) throw new BadRequestError('resource is required');
  if (resource.replace(/\/$/, '') !== mcpResource()) {
    throw new BadRequestError('Unknown resource');
  }

  const scopes = parseScopes(scope);
  if (scopes.length === 0) throw new BadRequestError('At least one known scope is required');

  return { clientId, redirectUri, state, scopes, resource: mcpResource(), codeChallenge };
}

/**
 * A token binding the consent form to this user and this request.
 *
 * Without it the decision endpoint is a plain cookie-authenticated POST, and
 * any page on the internet could submit one on a signed-in visitor's behalf —
 * granting an authorization code to a client the user never saw. Deriving it
 * rather than storing it keeps the endpoint stateless; binding it to the user
 * stops an attacker minting one from their own session, and to the code
 * challenge stops it being reused for a different authorization.
 */
const consentToken = (userId: string, clientId: string, codeChallenge: string): string =>
  createHmac('sha256', requireEnv('JWT_SECRET'))
    .update(`consent:${userId}:${clientId}:${codeChallenge}`)
    .digest('hex');

const consentTokenValid = (
  presented: unknown,
  userId: string,
  clientId: string,
  codeChallenge: string
): boolean => {
  if (typeof presented !== 'string') return false;
  const expected = Buffer.from(consentToken(userId, clientId, codeChallenge));
  const given = Buffer.from(presented);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
};

const scopeLabel = (scope: string): string => {
  const [area, access] = scope.split(':');
  const areas: Record<string, string> = {
    relationship: 'your journal',
    album: 'your photos',
    finance: 'your finances'
  };
  return `${access === 'write' ? 'Add to and change' : 'Read'} ${areas[area] ?? area}`;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

/**
 * The authorization endpoint.
 *
 * An unauthenticated visitor is sent through the ordinary login and returned
 * here, so there is exactly one way to sign in to Tumbaland and this is not it.
 */
export const authorize = async (req: Request, res: Response): Promise<void> => {
  const params = await validateAuthorizeRequest(req);

  if (!req.user) {
    const returnTo = `${issuer()}${req.originalUrl}`;
    res.redirect(`${authFrontUrl()}?redirect_uri=${encodeURIComponent(returnTo)}`);
    return;
  }

  const client = await findClient(params.clientId);
  const groups = req.userGroups ?? [];

  // Server-rendered, because a consent screen must come from the authorization
  // server itself — a page the client could influence is not consent.
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Tumbaland</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f6f6f7;margin:0;padding:2rem;color:#1a1a1a}
  .card{max-width:26rem;margin:2rem auto;background:#fff;border-radius:12px;padding:1.75rem;
        box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:1.25rem;margin:0 0 .25rem}
  p.sub{color:#666;margin:0 0 1.25rem;font-size:.9rem}
  ul{list-style:none;padding:0;margin:0 0 1.25rem}
  li{padding:.5rem .75rem;background:#f2f7ff;border-radius:8px;margin-bottom:.4rem;font-size:.9rem}
  label{display:block;font-size:.85rem;color:#444;margin:0 0 .35rem}
  select{width:100%;padding:.55rem;border:1px solid #ccc;border-radius:8px;margin-bottom:1.25rem}
  .row{display:flex;gap:.6rem}
  button{flex:1;padding:.7rem;border-radius:8px;border:0;font-size:.95rem;cursor:pointer}
  .approve{background:#1a73e8;color:#fff}
  .deny{background:#eee;color:#333}
  .who{font-size:.8rem;color:#888;margin-top:1rem;text-align:center}
</style></head><body>
<div class="card">
  <h1>Connect ${escapeHtml(client?.clientName ?? 'an application')}</h1>
  <p class="sub">It is asking to access your Tumbaland account.</p>
  <ul>${params.scopes.map((s) => `<li>${escapeHtml(scopeLabel(s))}</li>`).join('')}</ul>
  <form method="POST" action="${issuer()}/oauth/authorize">
    <label for="groupId">Which data should it act on?</label>
    <select id="groupId" name="groupId">
      <option value="">My own data</option>
      ${groups.map((g) => `<option value="${escapeHtml(g)}">Group ${escapeHtml(g.slice(-6))}</option>`).join('')}
    </select>
    <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
    <input type="hidden" name="scope" value="${escapeHtml(params.scopes.join(' '))}">
    <input type="hidden" name="resource" value="${escapeHtml(params.resource)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
    <input type="hidden" name="state" value="${escapeHtml(params.state ?? '')}">
    <input type="hidden" name="consent_token" value="${consentToken(req.user.id, params.clientId, params.codeChallenge)}">
    <div class="row">
      <button type="submit" name="decision" value="deny" class="deny">Cancel</button>
      <button type="submit" name="decision" value="approve" class="approve">Connect</button>
    </div>
  </form>
  <p class="who">Signed in as ${escapeHtml(req.user.email)}</p>
</div></body></html>`);
};

/**
 * What the user decided.
 *
 * The scopes and tenant are taken from this form rather than from the original
 * query, so what is stored on the code is exactly what was on screen when they
 * pressed the button.
 */
export const authorizeDecision = async (req: Request, res: Response): Promise<void> => {
  const {
    decision,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    resource,
    code_challenge: codeChallenge,
    state,
    groupId
  } = req.body as Record<string, string | undefined>;

  const client = clientId ? await findClient(clientId) : null;
  if (!client || !redirectUri || !isRegisteredRedirect(client, redirectUri)) {
    throw new BadRequestError('Unknown client or redirect_uri');
  }

  const back = new URL(redirectUri);
  if (state) back.searchParams.set('state', state);
  // RFC 9207: naming ourselves lets the client detect a mix-up attack.
  back.searchParams.set('iss', issuer());

  if (decision !== 'approve') {
    back.searchParams.set('error', 'access_denied');
    res.redirect(back.toString());
    return;
  }

  const scopes = parseScopes(scope);
  if (!req.user || scopes.length === 0 || !codeChallenge || !resource) {
    back.searchParams.set('error', 'invalid_request');
    res.redirect(back.toString());
    return;
  }

  // The form must be the one this server rendered for this user. A submission
  // that fails here is not a user decision, so it is refused outright rather
  // than redirected — sending an error to the client's URI would tell an
  // attacker their attempt was received.
  const { consent_token: consentTokenValue } = req.body as Record<string, string | undefined>;
  if (!consentTokenValid(consentTokenValue, req.user.id, client.clientId, codeChallenge)) {
    logger.warn('OAuth consent rejected: bad or missing consent token', {
      clientId: client.clientId,
      userId: req.user.id
    });
    throw new BadRequestError('This consent form is not valid. Start the connection again.');
  }

  // A key may only be pinned to a group the approver actually belongs to,
  // otherwise the tenant field could be used to reach into someone else's data.
  const pinned = groupId && (req.userGroups ?? []).includes(groupId) ? groupId : null;

  const code = await issueAuthorizationCode({
    clientId: client.clientId,
    userId: req.user.id,
    userEmail: req.user.email,
    userName: req.user.name,
    redirectUri,
    scopes,
    groupId: pinned,
    resource: mcpResource(),
    codeChallenge
  });

  logger.info('OAuth authorization granted', {
    clientId: client.clientId,
    userId: req.user.id,
    scopes,
    groupId: pinned
  });

  back.searchParams.set('code', code);
  res.redirect(back.toString());
};

const tokenError = (res: Response, error: string, description: string): void => {
  res.status(400).json({ error, error_description: description });
};

/**
 * The token endpoint: authorization codes and refresh tokens both land here.
 *
 * Errors use OAuth's own codes rather than the service's HttpError shapes,
 * because clients parse them — a client that gets `invalid_grant` knows to start
 * a fresh authorization, where a 400 with prose tells it nothing.
 */
export const token = async (req: Request, res: Response): Promise<void> => {
  const {
    grant_type: grantType,
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    refresh_token: refreshToken
  } = req.body as Record<string, string | undefined>;

  if (!clientId) return tokenError(res, 'invalid_client', 'client_id is required');

  if (grantType === 'authorization_code') {
    if (!code || !redirectUri || !codeVerifier) {
      return tokenError(res, 'invalid_request', 'code, redirect_uri and code_verifier are required');
    }

    const result = await redeemAuthorizationCode(code, clientId, redirectUri, codeVerifier);
    if (!result.ok || !result.code) {
      logger.warn('OAuth code exchange rejected', { rejection: result.rejection, clientId });
      return tokenError(res, 'invalid_grant', 'The authorization code is not valid');
    }

    const granted = result.code;
    const scopes = granted.scopes as ApiKeyScope[];
    const minted = mintAccessToken({
      userId: granted.userId,
      email: granted.userEmail,
      name: granted.userName,
      resource: granted.resource,
      issuer: issuer(),
      scopes,
      groupId: granted.groupId ?? null
    });

    const refresh = await issueRefreshToken({
      clientId,
      userId: granted.userId,
      scopes,
      groupId: granted.groupId ?? null,
      resource: granted.resource
    });

    res.json({
      access_token: minted.accessToken,
      token_type: 'Bearer',
      expires_in: minted.expiresIn,
      scope: minted.scope,
      refresh_token: refresh.token
    });
    return;
  }

  if (grantType === 'refresh_token') {
    if (!refreshToken) return tokenError(res, 'invalid_request', 'refresh_token is required');

    const result = await redeemRefreshToken(refreshToken, clientId);
    if (!result.ok || !result.userId) {
      if (result.reused) {
        logger.warn('Refresh token reuse detected; the grant has been revoked', { clientId });
      }
      return tokenError(res, 'invalid_grant', 'The refresh token is not valid');
    }

    const minted = mintAccessToken({
      userId: result.userId,
      // The snapshot lives on the code, not the refresh token; the access token
      // only needs these for display, and the id is what authorizes anything.
      email: '',
      name: '',
      resource: result.resource!,
      issuer: issuer(),
      scopes: result.scopes ?? [],
      groupId: result.groupId ?? null
    });

    res.json({
      access_token: minted.accessToken,
      token_type: 'Bearer',
      expires_in: minted.expiresIn,
      scope: minted.scope,
      // Rotated: the token just presented is dead, and the client must store
      // this one or its next refresh will read as a reuse.
      refresh_token: result.rotatedToken
    });
    return;
  }

  return tokenError(res, 'unsupported_grant_type', `Unsupported grant_type: ${grantType}`);
};

/**
 * The assistants a user has connected.
 *
 * Read from refresh tokens rather than a separate record, because a refresh
 * token *is* the connection: while one is live the assistant can keep minting
 * access tokens, and once it is gone the connection is over.
 */
export const getConnections = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await listConnections(req.user!.id));
};

/**
 * Disconnect an assistant.
 *
 * Revoking the refresh token is what actually cuts it off. Any access token it
 * already holds keeps working until it expires — at most an hour — which is the
 * trade made when access tokens were made stateless, and worth saying plainly
 * in the UI rather than implying the cut is instant.
 */
export const revokeConnection = async (req: Request, res: Response): Promise<void> => {
  const clientId = String(req.params.clientId);
  const revoked = await revokeRefreshTokensForUser(req.user!.id, clientId);

  if (revoked === 0) throw new NotFoundError('No active connection for that application');

  logger.info('OAuth connection revoked', { userId: req.user!.id, clientId, revoked });
  sendSuccess(res, { clientId, revoked });
};
