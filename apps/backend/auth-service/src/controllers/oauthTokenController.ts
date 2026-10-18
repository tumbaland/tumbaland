import { Request, Response } from 'express';
import {
  findClient,
  issueRefreshToken,
  logger,
  mintAccessToken,
  redeemAuthorizationCode,
  redeemRefreshToken
} from '@tumbaland/backend-core';
import type { ApiKeyScope } from '@tumbaland/backend-core';
import { User } from '../models/User';
import { effectiveName } from '../services/nameService';
import { issuer } from '../services/oauthConsent';

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
    // Resolved once here and carried on the token: an audit trail has to name
    // the assistant, and nothing downstream can turn a client id into a name.
    const clientName = (await findClient(clientId))?.clientName ?? 'A connected app';
    const minted = mintAccessToken({
      userId: granted.userId,
      email: granted.userEmail,
      name: granted.userName,
      resource: granted.resource,
      issuer: issuer(),
      scopes,
      tenants: granted.tenants,
      defaultTenant: granted.defaultTenant,
      tenantNames: granted.tenantNames ?? {},
      // Named on the token so an audit trail can say which assistant acted.
      // Nothing downstream can resolve a client id, and `jti` rotates hourly.
      clientId,
      clientName
    });

    const refresh = await issueRefreshToken({
      clientId,
      userId: granted.userId,
      scopes,
      tenants: granted.tenants,
      defaultTenant: granted.defaultTenant,
      tenantNames: granted.tenantNames ?? {},
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

    // The refresh token carries no email, and the email is what group
    // membership is looked up by: a token minted without one keeps the shared
    // journal on its list but is refused in it, an hour after every sign-in.
    const user = await User.findById(result.userId).select('email firstName lastName googleName');
    if (!user) return tokenError(res, 'invalid_grant', 'The refresh token is not valid');

    const minted = mintAccessToken({
      userId: result.userId,
      email: user.email,
      name: effectiveName(user) ?? '',
      resource: result.resource!,
      issuer: issuer(),
      scopes: result.scopes ?? [],
      tenants: result.tenants!.allowed,
      defaultTenant: result.tenants!.default,
      tenantNames: result.tenantNames ?? {},
      clientId,
      clientName: (await findClient(clientId))?.clientName ?? 'A connected app'
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
