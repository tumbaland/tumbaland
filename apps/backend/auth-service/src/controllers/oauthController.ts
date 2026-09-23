import { Request, Response } from 'express';
import {
  BadRequestError,
  findClient,
  isRegisteredRedirect,
  issueAuthorizationCode,
  logger,
  parseScopes,
  registerClient,
  API_KEY_SCOPES,
  PERSONAL_TENANT
} from '@tumbaland/backend-core';
import type { ApiKeyScope } from '@tumbaland/backend-core';
import { renderConsentPage } from '../services/consentPage';
import {
  authFrontUrl,
  consentToken,
  consentTokenValid,
  issuer,
  mcpResource,
  tenantNamesFor
} from '../services/oauthConsent';

/**
 * OAuth 2.1 authorization server, for assistants connecting over MCP.
 *
 * Lives in auth-service because it already owns identity: the user is
 * authenticated here by the same Google session the web app uses, so consent is
 * something they give while signed in rather than a second set of credentials.
 */

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
  const names = await tenantNamesFor(req.user.email, groups);

  // Personal first, then every group. A person who belongs to one group sees two
  // rows, both offered — the previous screen made them pick one and reconnect to
  // change their mind.
  const tenants = [PERSONAL_TENANT, ...groups];

  // What a fresh connection should reach unless the approver says otherwise. A
  // group is the better guess than personal: a shared journal is the reason
  // most people connect anything at all.
  const suggestedDefault = groups[0] ?? PERSONAL_TENANT;

  // Server-rendered, because a consent screen must come from the authorization
  // server itself — a page the client could influence is not consent.
  res.type('html').send(
    renderConsentPage({
      action: `${issuer()}/oauth/authorize`,
      clientName: client?.clientName,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      state: params.state,
      scopes: params.scopes,
      resource: params.resource,
      codeChallenge: params.codeChallenge,
      consentToken: consentToken(req.user.id, params.clientId, params.codeChallenge),
      tenants,
      tenantNames: names,
      suggestedDefault,
      email: req.user.email
    })
  );
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
    state
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

  // A credential may only reach a tenant the approver actually belongs to.
  // Filtered rather than trusted: the form is the approver's, but the request
  // carrying it is the client's, and a tenant field taken at face value is a
  // way into someone else's data.
  const reachable = new Set([PERSONAL_TENANT, ...(req.userGroups ?? [])]);
  const submitted = ([] as string[])
    .concat(req.body.tenant ?? [])
    .filter((tenant) => reachable.has(tenant));

  const defaultTenant = reachable.has(req.body.defaultTenant as string)
    ? (req.body.defaultTenant as string)
    : PERSONAL_TENANT;

  // The default is always in the grant, so the set can never come out empty —
  // there is no way to approve a connection that reaches nothing and then fails
  // every call it makes.
  const tenants = [...new Set([defaultTenant, ...submitted])];
  const names = await tenantNamesFor(req.user.email, tenants.filter((t) => t !== PERSONAL_TENANT));
  const tenantNames = Object.fromEntries(tenants.map((tenant) => [tenant, names[tenant] ?? tenant]));

  const code = await issueAuthorizationCode({
    clientId: client.clientId,
    userId: req.user.id,
    userEmail: req.user.email,
    userName: req.user.name,
    redirectUri,
    scopes,
    tenants,
    defaultTenant,
    tenantNames,
    resource: mcpResource(),
    codeChallenge
  });

  logger.info('OAuth authorization granted', {
    clientId: client.clientId,
    userId: req.user.id,
    scopes,
    tenants,
    defaultTenant
  });

  back.searchParams.set('code', code);
  res.redirect(back.toString());
};
