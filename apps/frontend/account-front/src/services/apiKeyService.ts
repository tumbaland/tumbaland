import { accountApi } from './accountApi';

/** Everything a key may be granted, paired with wording a person can act on. */
export const API_KEY_SCOPES = [
  { value: 'relationship:read', label: 'Journal — read', group: 'Journal' },
  { value: 'relationship:write', label: 'Journal — write', group: 'Journal' },
  { value: 'album:read', label: 'Photos — read', group: 'Photos' },
  { value: 'album:write', label: 'Photos — write', group: 'Photos' },
  { value: 'finance:read', label: 'Money — read', group: 'Money' },
  { value: 'finance:write', label: 'Money — write', group: 'Money' }
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]['value'];

/**
 * The user's own data, as a tenant.
 *
 * A named value rather than null, matching the server: a tenant is always a
 * plain string, so the set a credential is granted is an ordinary array with no
 * special case in it.
 */
export const PERSONAL_TENANT = 'personal';

export interface ApiKey {
  id: string;
  name: string;
  /** the public half — enough to tell two keys apart, not enough to use one */
  prefix: string;
  scopes: ApiKeyScope[];
  /** every scope of data this key may reach */
  tenants: string[];
  /** the one it uses when a request names none */
  defaultTenant: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** The create response is the one place the token comes back unasked. */
export interface CreatedApiKey extends ApiKey {
  token: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScope[];
  tenants?: string[];
  defaultTenant?: string;
  expiresAt?: string | null;
}

interface Wrapped<T> {
  success: boolean;
  data: T;
}

export const apiKeyService = {
  async list(): Promise<ApiKey[]> {
    const response = await accountApi.get<Wrapped<ApiKey[]>>('/auth/api-keys');
    return response.data;
  },

  async create(request: CreateApiKeyRequest): Promise<CreatedApiKey> {
    const response = await accountApi.post<Wrapped<CreatedApiKey>>('/auth/api-keys', request);
    return response.data;
  },

  /**
   * A POST rather than a GET on the key: the response is a working credential,
   * and a GET is the shape that ends up in browser history and access logs.
   */
  async reveal(id: string): Promise<string> {
    const response = await accountApi.post<Wrapped<{ token: string }>>(`/auth/api-keys/${id}/reveal`, {});
    return response.data.token;
  },

  async revoke(id: string): Promise<ApiKey> {
    const response = await accountApi.post<Wrapped<ApiKey>>(`/auth/api-keys/${id}/revoke`, {});
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await accountApi.delete<Wrapped<{ id: string }>>(`/auth/api-keys/${id}`);
  }
};

/**
 * An assistant connected through OAuth.
 *
 * Distinct from an API key: nobody copied a secret anywhere, they approved a
 * consent screen. Revoking is therefore the only control that matters here —
 * there is nothing to reveal.
 */
export interface Connection {
  id: string;
  clientId: string;
  clientName: string;
  scopes: ApiKeyScope[];
  tenants: string[];
  defaultTenant: string;
  /** what each granted tenant was called when the connection was approved */
  tenantNames: Record<string, string>;
  createdAt: string;
  /** Set when the refresh token is exchanged, not when a tool runs. */
  lastRenewedAt: string | null;
  revokedAt: string | null;
}

export const connectionService = {
  async list(): Promise<Connection[]> {
    const response = await accountApi.get<Wrapped<Connection[]>>('/auth/connections');
    return response.data;
  },

  async revoke(clientId: string): Promise<void> {
    await accountApi.delete<Wrapped<{ clientId: string }>>(`/auth/connections/${clientId}`);
  }
};
