import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import { ApiError } from '@tumbaland/frontend-core';
import type { Assistants, ClaudeKey, ClaudeKeyChange, ClaudeUsage, Deletions, Overview, UserDetail, UserList, UserListQuery } from '../types';

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

/** chat-service: the key the chat assistants run on. Also admin-only, and written there, next to the code that uses it. */
const chat = createApiClient({ baseUrl: () => getGlobalConfig().CHAT_API_URL ?? '', onUnauthorized: toSignIn });

/** payment-service: a person's limits, which are plan limits with an override on top. */
const payment = createApiClient({ baseUrl: () => getGlobalConfig().PAYMENT_API_URL ?? '', onUnauthorized: toSignIn });

/** The meter an assistant allowance is counted in: ten-thousandths of a dollar. */
export const UNITS_PER_DOLLAR = 10_000;

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

  async claudeKey(): Promise<ClaudeKey> {
    return (await chat.get<Wrapped<ClaudeKey>>('/api/chat/admin/assistant-key')).data;
  },

  /** Any part may be sent alone. A new key is checked with Anthropic before it is kept. */
  async saveClaudeKey(change: ClaudeKeyChange): Promise<ClaudeKey> {
    return (await chat.put<Wrapped<ClaudeKey>>('/api/chat/admin/assistant-key', change)).data;
  },

  /** Asks Anthropic about the saved key again, and puts a rejected one back to work if it is accepted now. */
  async checkClaudeKey(): Promise<ClaudeKey> {
    return (await chat.post<Wrapped<ClaudeKey>>('/api/chat/admin/assistant-key/check')).data;
  },

  async removeClaudeKey(): Promise<ClaudeKey> {
    return (await chat.delete<Wrapped<ClaudeKey>>('/api/chat/admin/assistant-key')).data;
  },

  async claudeUsage(month: string): Promise<ClaudeUsage> {
    return (await chat.get<Wrapped<ClaudeUsage>>('/api/chat/admin/assistant-usage', { params: { month } })).data;
  },

  /**
   * Gives one person a different assistant allowance, in units, or none (`-1`).
   *
   * An override is replaced whole by the server, so the one they already have is
   * read first and only the allowance in it changes: anything else an admin
   * granted them, such as extra storage, is kept.
   */
  async setAllowance(email: string, units: number, reason: string, expiresAt?: string): Promise<void> {
    const path = `/api/overrides/${encodeURIComponent(email)}`;
    let existing: { meters?: Record<string, number>; features?: Record<string, boolean>; retentionDays?: number } = {};
    try {
      existing = (await payment.get<{ override: typeof existing }>(path)).override ?? {};
    } catch (error) {
      // No override yet is the usual case, and not a failure.
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
    await payment.put(path, {
      meters: { ...existing.meters, assistantSpend: units },
      features: existing.features,
      retentionDays: existing.retentionDays,
      reason,
      expiresAt: expiresAt || undefined
    });
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
