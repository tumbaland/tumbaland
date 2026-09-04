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
 * A tenant a credential may act in: a group id, or the user's own data.
 *
 * Personal is a named sentinel rather than `null` so that a tenant is always a
 * plain string — storable in an array, sendable in a JWT claim, comparable
 * without a special case at every layer. It cannot collide with a real tenant:
 * group ids are 24-character hex.
 */
export const PERSONAL_TENANT = 'personal';

export type Tenant = string;

/** The `groupId` a tenant corresponds to, as handlers have always read it. */
export const groupIdOf = (tenant: Tenant): string | null =>
  tenant === PERSONAL_TENANT ? null : tenant;

/**
 * Which tenants a credential may act in, and which one it acts in by default.
 *
 * The web app picks a tenant per request from a selector; an agent has no such
 * UI. So the *set* is chosen once, by a person, and the credential cannot escape
 * it — but within that set the caller may name one per request, which is what
 * lets a single connection reach both a shared journal and a private photo
 * library without reconnecting.
 *
 * `allowed` is never empty and always contains `default`. A credential granted
 * exactly one tenant behaves precisely as a pinned one did: nothing to name,
 * nothing to get wrong.
 */
export interface ApiKeyTenant {
  allowed: Tenant[];
  default: Tenant;
}

/** Just the groups, for the `req.userGroups` every handler already reads. */
export const groupIdsOf = (tenants: Tenant[]): string[] =>
  tenants.filter((tenant) => tenant !== PERSONAL_TENANT);

/**
 * Read a stored tenant grant, tolerating one written before tenants were a set.
 *
 * Keys and grants issued under the old single-tenant model carry `groupId`
 * alone. Falling back to it here means they keep working across the deploy
 * rather than every connected assistant breaking at once.
 */
export const readTenants = (stored: {
  tenants?: Tenant[] | null;
  defaultTenant?: Tenant | null;
  groupId?: string | null;
}): ApiKeyTenant => {
  const allowed =
    stored.tenants && stored.tenants.length > 0
      ? stored.tenants
      : [stored.groupId ?? PERSONAL_TENANT];

  const fallbackDefault = allowed[0] as Tenant;
  const preferred = stored.defaultTenant ?? fallbackDefault;

  return {
    allowed,
    default: allowed.includes(preferred) ? preferred : fallbackDefault
  };
};

/** A key as the API hands it back — never including the secret. */
export interface ApiKeySummary {
  id: string;
  name: string;
  /** the public half, shown in listings so a key is identifiable at a glance */
  prefix: string;
  scopes: ApiKeyScope[];
  tenants: Tenant[];
  defaultTenant: Tenant;
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
  tenants?: ApiKeyTenant;
}
