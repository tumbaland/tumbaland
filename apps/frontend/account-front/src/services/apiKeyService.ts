import { accountApi } from './accountApi';

/** Everything a key may be granted, paired with wording a person can act on. */
export const API_KEY_SCOPES = [
  { value: 'relationship:read', label: 'Relationship — read', group: 'Relationship' },
  { value: 'relationship:write', label: 'Relationship — write', group: 'Relationship' },
  { value: 'album:read', label: 'Photos — read', group: 'Photos' },
  { value: 'album:write', label: 'Photos — write', group: 'Photos' },
  { value: 'finance:read', label: 'Finance — read', group: 'Finance' },
  { value: 'finance:write', label: 'Finance — write', group: 'Finance' }
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]['value'];

export interface ApiKey {
  id: string;
  name: string;
  /** the public half — enough to tell two keys apart, not enough to use one */
  prefix: string;
  scopes: ApiKeyScope[];
  groupId: string | null;
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
  groupId?: string | null;
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
  groupId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
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
