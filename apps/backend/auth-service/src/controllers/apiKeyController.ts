import { Request, RequestHandler, Response } from 'express';
import {
  BadRequestError,
  NotFoundError,
  isEncryptionConfigured,
  createApiKey,
  listApiKeys,
  revealApiKey,
  revokeApiKey,
  deleteApiKey,
  logger,
  sendSuccess,
  PERSONAL_TENANT
} from '@tumbaland/backend-core';
import type { ApiKeyScope } from '@tumbaland/backend-core';

/**
 * Managing keys is always a person's job, never software's — the routes are
 * mounted behind `authenticateToken`, so `req.user` here is a session.
 */

/**
 * Refuse the key routes clearly when the service cannot encrypt.
 *
 * Without `API_KEY_ENCRYPTION_SECRET` the very first key creation threw deep
 * inside the cipher and surfaced as a bare 500 — a misconfigured deployment
 * looked like a bug. This names the missing variable instead, and does it as a
 * 503 because the fault is the server's and it is fixable without changing the
 * request. Login and the rest of auth-service are unaffected, which is why this
 * guards the routes rather than refusing to boot.
 */
export const requireApiKeysConfigured: RequestHandler = (_req, res, next) => {
  if (!isEncryptionConfigured()) {
    logger.error('API key routes are unavailable: API_KEY_ENCRYPTION_SECRET is not set');
    res.status(503).json({
      success: false,
      message: 'API keys are not configured on this server (API_KEY_ENCRYPTION_SECRET is missing)'
    });
    return;
  }
  next();
};

/** Express 5 types a route param as `string | string[]`; this route only ever has one. */
const keyId = (req: Request): string => String(req.params.id);

export const getApiKeys = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await listApiKeys(req.user!.id));
};

/**
 * Issue a key.
 *
 * The tenants are fixed here and cannot be changed later: a key's whole safety
 * argument is that the agent holding it cannot wander into data its owner did
 * not mean to expose. Re-pointing a key would quietly invalidate that, so the
 * answer to "wrong group" is a new key.
 *
 * Several tenants may be granted at once — a key can reach a shared journal and
 * the owner's own photos without two connections — but only ones its creator
 * actually belongs to, and only ones they ticked.
 */
export const postApiKey = async (req: Request, res: Response): Promise<void> => {
  const { name, scopes, tenants, defaultTenant, expiresAt } = req.body as {
    name: string;
    scopes: ApiKeyScope[];
    tenants?: string[];
    defaultTenant?: string;
    expiresAt?: string | null;
  };

  // A key may only reach tenants its creator belongs to — without this the
  // grant could be used to mint access rather than restrict it.
  const reachable = new Set([PERSONAL_TENANT, ...(req.userGroups ?? [])]);
  const requested = tenants?.length ? tenants : [defaultTenant ?? PERSONAL_TENANT];
  const outside = requested.filter((tenant) => !reachable.has(tenant));
  if (outside.length > 0) {
    throw new BadRequestError('You are not a member of that group');
  }

  const fallback = requested.includes(defaultTenant ?? '')
    ? (defaultTenant as string)
    : (requested[0] as string);

  const created = await createApiKey({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userName: req.user!.name,
    name,
    scopes,
    tenants: requested,
    defaultTenant: fallback,
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });

  logger.info('API key created', {
    userId: req.user!.id,
    keyId: created.summary.id,
    scopes,
    tenants: requested,
    defaultTenant: fallback
  });

  // The only response that carries the token without an explicit reveal.
  res.status(201).json({
    success: true,
    data: { ...created.summary, token: created.token }
  });
};

/**
 * Hand the key back in the clear.
 *
 * Deliberately a POST, not a GET on the key resource: a secret has no business
 * turning up in a URL, a browser history, or an access log, and a GET is the
 * shape most likely to be logged, cached, or prefetched. Rate limiting and the
 * audit counter live on this route because it is the one worth watching.
 */
export const postApiKeyReveal = async (req: Request, res: Response): Promise<void> => {
  const id = keyId(req);
  const token = await revealApiKey(req.user!.id, id);
  if (!token) throw new NotFoundError('API key not found');

  logger.info('API key revealed', { userId: req.user!.id, keyId: id });

  sendSuccess(res, { token });
};

export const postApiKeyRevoke = async (req: Request, res: Response): Promise<void> => {
  const id = keyId(req);
  const summary = await revokeApiKey(req.user!.id, id);
  if (!summary) throw new NotFoundError('API key not found');

  logger.info('API key revoked', { userId: req.user!.id, keyId: id });

  sendSuccess(res, summary);
};

export const removeApiKey = async (req: Request, res: Response): Promise<void> => {
  const id = keyId(req);
  const deleted = await deleteApiKey(req.user!.id, id);
  if (!deleted) throw new NotFoundError('API key not found');

  logger.info('API key deleted', { userId: req.user!.id, keyId: id });

  sendSuccess(res, { id });
};
