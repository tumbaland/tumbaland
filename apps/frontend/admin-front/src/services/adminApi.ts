import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import type { Assistants, Deletions, Overview, UserDetail, UserList, UserListQuery } from '../types';

const toSignIn = () => {
  const { AUTH_FRONT_URL } = getGlobalConfig();
  if (AUTH_FRONT_URL) {
    window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
  }
};

/** admin-service: everything the screens read. */
const admin = createApiClient({ baseUrl: () => getGlobalConfig().ADMIN_API_URL ?? '', onUnauthorized: toSignIn });

/**
 * auth-service: the one thing an administrator changes. It lives there, next to
 * the accounts it changes, and not in admin-service, which only reads.
 */
const auth = createApiClient({ baseUrl: () => getGlobalConfig().AUTH_SERVICE_URL ?? '', onUnauthorized: toSignIn });

interface Wrapped<T> {
  success: boolean;
  data: T;
}

export interface ClosedAccount {
  id: string;
  email: string;
  sessionsEnded: number;
  connectionsRevoked: number;
  keysRevoked: number;
}

export const adminApi = {
  async overview(days = 30): Promise<Overview> {
    return (await admin.get<Wrapped<Overview>>('/api/overview', { params: { days } })).data;
  },

  async users(query: UserListQuery = {}): Promise<UserList> {
    return (await admin.get<Wrapped<UserList>>('/api/users', { params: { ...query } })).data;
  },

  async user(id: string): Promise<UserDetail> {
    return (await admin.get<Wrapped<UserDetail>>(`/api/users/${encodeURIComponent(id)}`)).data;
  },

  async assistants(days = 30): Promise<Assistants> {
    return (await admin.get<Wrapped<Assistants>>('/api/assistants', { params: { days } })).data;
  },

  async deletions(): Promise<Deletions> {
    return (await admin.get<Wrapped<Deletions>>('/api/deletions')).data;
  },

  /** Closes an account that asked to be deleted. Nothing is removed. */
  async confirmDeletion(id: string): Promise<ClosedAccount> {
    return (await auth.post<Wrapped<ClosedAccount>>(`/auth/admin/users/${encodeURIComponent(id)}/deletion/confirm`)).data;
  },

  /** Takes a confirmation back, for a mistake. */
  async reopenAccount(id: string): Promise<void> {
    await auth.post(`/auth/admin/users/${encodeURIComponent(id)}/deletion/reopen`);
  }
};
