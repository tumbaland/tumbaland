/**
 * API keys let a non-browser client — an MCP server driving Claude or ChatGPT,
 * a script, a cron job — act as a user without a Google sign-in flow.
 *
 * They are deliberately narrower than a session: a session is a person at a
 * keyboard who can see what they are doing, while a key is handed to software
 * that acts on its own. So a key carries explicit scopes, and it pins the tenant
 * it writes to rather than choosing one per request the way the UI does.
 */

/** Everything a key may be granted. Read and write are separate on purpose. */
export const API_KEY_SCOPES = [
  'relationship:read',
  'relationship:write',
  'album:read',
  'album:write',
  'finance:read',
  'finance:write'
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const isApiKeyScope = (value: unknown): value is ApiKeyScope =>
  typeof value === 'string' && (API_KEY_SCOPES as readonly string[]).includes(value);

/**
 * The tenant a key acts in, fixed when the key is created.
 *
 * The web app picks this per request from a tenant selector, but an agent has no
 * such UI and no way to know it guessed wrong — so the choice is made once, by a
 * person, and the key cannot escape it. `groupId: null` means the user's own
 * non-group data.
 */
export interface ApiKeyTenant {
  groupId: string | null;
}

/** A key as the API hands it back — never including the secret. */
export interface ApiKeySummary {
  id: string;
  name: string;
  /** the public half, shown in listings so a key is identifiable at a glance */
  prefix: string;
  scopes: ApiKeyScope[];
  groupId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** Why a presented key was refused. Kept out of the HTTP response — see the middleware. */
export type ApiKeyRejection =
  | 'malformed'
  | 'unknown'
  | 'revoked'
  | 'expired'
  | 'bad-secret';

export interface ApiKeyVerification {
  ok: boolean;
  rejection?: ApiKeyRejection;
  userId?: string;
  userEmail?: string;
  userName?: string;
  keyId?: string;
  scopes?: ApiKeyScope[];
  groupId?: string | null;
}
