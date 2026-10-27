import { ApiKey, OAuthClient, RefreshToken } from '@tumbaland/backend-core';
import { at } from './seed';

/**
 * Connected apps and keys for one account, written straight to the collections.
 *
 * Through the models' own `create` they would go through the audit plugin and
 * the key schema's required secrets, neither of which this is about.
 *
 *  - two live connections to Claude (a refresh token per session) and one live to another app
 *  - one revoked connection to Claude
 *  - three keys: live, revoked, expired
 */
export async function seedCredentials(userId: string): Promise<void> {
  await OAuthClient.collection.insertMany([
    { clientId: 'client-claude', clientName: 'Claude', redirectUris: ['https://claude.ai/cb'] },
    { clientId: 'client-other', clientName: 'Other Assistant', redirectUris: ['https://other.example/cb'] }
  ]);

  const token = (clientId: string, fields: Record<string, unknown> = {}) => ({
    tokenHash: `secret-hash-${Math.random()}`,
    clientId,
    userId,
    scopes: ['relationship:read'],
    tenants: ['personal'],
    defaultTenant: 'personal',
    resource: 'https://mcp.example.com',
    grantedAt: at('2026-10-01T10:00:00Z'),
    createdAt: at('2026-10-01T10:00:00Z'),
    ...fields
  });
  await RefreshToken.collection.insertMany([
    token('client-claude', { lastUsedAt: at('2026-10-26T10:00:00Z') }),
    token('client-claude'),
    token('client-other'),
    token('client-claude', { revokedAt: at('2026-10-02T10:00:00Z') })
  ]);

  const key = (name: string, fields: Record<string, unknown> = {}) => ({
    userId,
    userEmail: 'ada@example.com',
    userName: 'Ada',
    name,
    keyId: `key-id-${name}`,
    hash: `secret-hash-${name}`,
    sealedCiphertext: 'sealed',
    sealedIv: 'iv',
    sealedTag: 'tag',
    scopes: ['relationship:read'],
    tenants: ['personal'],
    defaultTenant: 'personal',
    revealCount: 0,
    createdAt: at('2026-10-01T10:00:00Z'),
    ...fields
  });
  await ApiKey.collection.insertMany([
    key('live', { lastUsedAt: at('2026-10-25T10:00:00Z') }),
    key('revoked', { revokedAt: at('2026-10-05T10:00:00Z') }),
    key('expired', { expiresAt: at('2026-10-10T10:00:00Z') })
  ]);
}

