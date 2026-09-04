import { ApiKey, IApiKey } from './ApiKey';
import {
  decryptSecret,
  displayPrefix,
  encryptSecret,
  generateKey,
  parseKey,
  secretMatches
} from './crypto';
import {
  PERSONAL_TENANT,
  readTenants,
  type ApiKeyScope,
  type ApiKeySummary,
  type ApiKeyVerification,
  type Tenant
} from './types';

export interface CreateApiKeyInput {
  userId: string;
  userEmail: string;
  userName: string;
  name: string;
  scopes: ApiKeyScope[];
  /** every tenant the key may act in; defaults to the user's own data alone */
  tenants?: Tenant[];
  /** which of them it acts in when a request names none */
  defaultTenant?: Tenant;
  expiresAt?: Date | null;
}

export interface CreatedApiKey {
  summary: ApiKeySummary;
  /** the full token — the only time it is returned without an explicit reveal */
  token: string;
}

const toSummary = (key: IApiKey): ApiKeySummary => ({
  id: String(key._id),
  name: key.name,
  prefix: displayPrefix(key.keyId),
  scopes: key.scopes,
  ...(({ allowed, default: fallback }) => ({ tenants: allowed, defaultTenant: fallback }))(
    readTenants(key)
  ),
  createdAt: key.createdAt.toISOString(),
  lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
  expiresAt: key.expiresAt?.toISOString() ?? null,
  revokedAt: key.revokedAt?.toISOString() ?? null
});

export const createApiKey = async (input: CreateApiKeyInput): Promise<CreatedApiKey> => {
  // A key that reaches nowhere would authenticate and then fail every call, so
  // an empty grant is read as the safest non-empty one rather than stored.
  const tenants = input.tenants?.length ? input.tenants : [PERSONAL_TENANT];

  const { token, id, hash } = generateKey();
  const sealed = encryptSecret(token);

  const key = await ApiKey.create({
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    name: input.name,
    keyId: id,
    hash,
    sealedCiphertext: sealed.ciphertext,
    sealedIv: sealed.iv,
    sealedTag: sealed.tag,
    scopes: input.scopes,
    tenants,
    defaultTenant: tenants.includes(input.defaultTenant ?? '')
      ? input.defaultTenant
      : (tenants[0] as Tenant),
    expiresAt: input.expiresAt ?? undefined
  });

  return { summary: toSummary(key), token };
};

export const listApiKeys = async (userId: string): Promise<ApiKeySummary[]> => {
  const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 });
  return keys.map(toSummary);
};

/**
 * Read a key back in the clear.
 *
 * Scoped to the owner by query rather than by a check afterwards, so there is no
 * path where a mismatched userId still reaches the decrypt. Revoked keys are
 * still revealable — the user may need to see which key they just turned off.
 */
export const revealApiKey = async (userId: string, id: string): Promise<string | null> => {
  const key = await ApiKey.findOne({ _id: id, userId });
  if (!key) return null;

  const token = decryptSecret({
    ciphertext: key.sealedCiphertext,
    iv: key.sealedIv,
    tag: key.sealedTag
  });

  key.revealCount += 1;
  key.lastRevealedAt = new Date();
  await key.save();

  return token;
};

/** Revoking is a tombstone, not a delete: the audit trail outlives the key. */
export const revokeApiKey = async (userId: string, id: string): Promise<ApiKeySummary | null> => {
  const key = await ApiKey.findOne({ _id: id, userId });
  if (!key) return null;

  if (!key.revokedAt) {
    key.revokedAt = new Date();
    await key.save();
  }

  return toSummary(key);
};

export const deleteApiKey = async (userId: string, id: string): Promise<boolean> => {
  const { deletedCount } = await ApiKey.deleteOne({ _id: id, userId });
  return deletedCount > 0;
};

/**
 * Check a presented token.
 *
 * Every failure returns the same shape and the caller answers all of them with
 * one message: distinguishing "no such key" from "wrong secret" to the client
 * would confirm which half of a guess was right. The `rejection` field exists
 * for the server's own logs.
 *
 * `lastUsedAt` is written on the side and never awaited — it is a convenience
 * for the listing UI, and making every authenticated request wait on a write to
 * maintain it would be a poor trade.
 */
export const verifyApiKey = async (token: unknown): Promise<ApiKeyVerification> => {
  const parsed = parseKey(token);
  if (!parsed) return { ok: false, rejection: 'malformed' };

  const key = await ApiKey.findOne({ keyId: parsed.id });
  if (!key) return { ok: false, rejection: 'unknown' };
  if (key.revokedAt) return { ok: false, rejection: 'revoked' };
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
    return { ok: false, rejection: 'expired' };
  }
  if (!secretMatches(parsed.secret, key.hash)) {
    return { ok: false, rejection: 'bad-secret' };
  }

  void ApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {
    // A missed usage timestamp must never fail an otherwise valid request.
  });

  return {
    ok: true,
    userId: key.userId,
    userEmail: key.userEmail,
    userName: key.userName,
    keyId: String(key._id),
    scopes: key.scopes,
    tenants: readTenants(key)
  };
};
