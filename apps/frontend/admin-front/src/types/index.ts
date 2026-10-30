/**
 * What admin-service answers, as the screens read it. Mirrors the service's own
 * types (apps/backend/admin-service/src/services); there is deliberately no
 * shared package for them, so a change on one side is a compile error nowhere
 * and a test failure here.
 */

export type DeletionState = 'requested' | 'closed' | null;

export interface Overview {
  generatedAt: string;
  range: { from: string; to: string };
  accounts: { total: number; pendingDeletions: number };
  active: { today: number; last7: number; last30: number };
  daily: Array<{ day: string; users: number; visits: number }>;
  includesBackfilled: boolean;
  signups: Array<{ week: string; users: number }>;
  cohorts: Array<{ week: string; size: number; retention: Record<string, number | null> }>;
  opensByWeek: Array<{ week: string; modules: Record<string, number> }>;
  pairs: { total: number; bothActiveLast7: number };
  assistants: { callsThisMonth: number; tokensThisMonth: number; failedThisMonth: number };
  marketData: { used: number; limit: number; date: string };
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastVisitAt: string | null;
  activeDays7: number;
  activeDays30: number;
  visits30: number;
  topModules: Array<{ module: string; opens: number }>;
  plan: { code: string; stale: boolean };
  storage: { used: number; limit: number };
  connections: number;
  keys: number;
  assistantCalls30: number;
  deletion: DeletionState;
  isAdmin: boolean;
}

export interface UserList {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
}

export type UserSort = 'lastVisit' | 'signup' | 'activeDays30' | 'visits30' | 'email';

export interface UserListQuery {
  sort?: UserSort;
  order?: 'asc' | 'desc';
  page?: number;
  q?: string;
}

export interface MeterReading {
  meter: string;
  label: string;
  unit: 'bytes' | 'count';
  period: string;
  used: number;
  limit: number;
  metered: boolean;
}

export interface QuotaReading {
  plan: string;
  stale: boolean;
  meters: MeterReading[];
}

export interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string | null;
    roles: string[];
    createdAt: string;
    lastLoginAt: string | null;
    deletion: {
      state: DeletionState;
      requestedAt: string | null;
      confirmedAt: string | null;
      confirmedBy: string | null;
    };
  };
  visits: {
    from: string;
    to: string;
    days: Array<{ day: string; visits: number; platform: Record<string, number>; country: string | null; backfilled: boolean }>;
    totalActiveDays: number;
    firstActiveDay: string | null;
    platforms: Record<string, number>;
    countries: Record<string, number>;
  };
  modules: {
    opens: Array<{ module: string; opens: number }>;
    writes: Array<{ service: string; resource: string; action: string; count: number }>;
  };
  quota: {
    own: QuotaReading;
    pooled: Array<{ billedTo: string; groups: string[]; quota: QuotaReading }>;
  };
  apps: {
    connections: Array<{
      clientId: string;
      clientName: string;
      scopes: string[];
      tenants: string[];
      grantedAt: string;
      lastUsedAt: string | null;
    }>;
    keys: Array<{
      name: string;
      state: 'active' | 'revoked' | 'expired';
      scopes: string[];
      tenants: string[];
      createdAt: string;
      lastUsedAt: string | null;
      expiresAt: string | null;
    }>;
    devices: Array<{ label: string; country: string | null; createdAt: string; lastSeenAt: string }>;
  };
  assistants: {
    windowDays: number;
    clients: Array<{
      credentialId: string | null;
      label: string;
      kind: string;
      calls: number;
      failed: number;
      tokens: number;
      avgMs: number;
      lastAt: string | null;
    }>;
    tools: Array<{ name: string; calls: number; failed: number; tokens: number; avgMs: number }>;
    daily: Array<{ day: string; calls: number; tokens: number }>;
    elsewhere: Array<{ service: string; action: string; actorKind: string; count: number }>;
  };
}

export interface Assistants {
  windowDays: number;
  totals: { calls: number; failed: number; tokens: number; accounts: number };
  clients: Array<{
    clientId: string;
    name: string;
    connectedAccounts: number;
    calls: number;
    failed: number;
    tokens: number;
    activeAccounts: number;
    lastCallAt: string | null;
  }>;
  tools: Array<{
    name: string;
    calls: number;
    failed: number;
    failureRate: number;
    tokens: number;
    avgTokens: number;
    avgMs: number;
  }>;
  keys: { live: number; actionsInWindow: number };
}

export interface DeletionEntry {
  id: string;
  email: string;
  name: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  lastVisitAt: string | null;
  visitedSinceRequest: boolean;
  groups: Array<{ name: string; role: string; otherMembers: string[] }>;
  owns: { albums: number; photos: number; activities: number; storageBytes: number };
}

export interface Deletions {
  requested: DeletionEntry[];
  closed: DeletionEntry[];
}

// ─── Claude: the chat assistants' key, models and cost ────────────────────────

export type ClaudeModelId = 'claude-haiku-5-5' | 'claude-sonnet-5-5' | 'claude-opus-5-5';

/** chat-service's answer for the Claude page. The key itself is never in it. */
export interface ClaudeKey {
  configured: boolean;
  /** False when chat-service has no secret to seal a key with: nothing can be saved. */
  encryptionReady: boolean;
  last4: string | null;
  expiresOn: string | null;
  daysLeft: number | null;
  expiringSoon: boolean;
  status: 'ok' | 'rejected' | null;
  rejectedReason: string | null;
  checkedAt: string | null;
  models: { enabled: ClaudeModelId[]; default: ClaudeModelId };
  catalog: Array<{ id: ClaudeModelId; label: string; name: string; hint: string; inputPerMTok: number; outputPerMTok: number }>;
  botCounts: Record<ClaudeModelId, number>;
  setBy: string | null;
  setAt: string | null;
}

export interface ClaudeKeyChange {
  apiKey?: string;
  models?: { enabled: ClaudeModelId[]; default: ClaudeModelId };
  expiresOn?: string | null;
}

/** One month of assistant use. Amounts are in ten-thousandths of a dollar. */
export interface ClaudeUsage {
  month: string;
  totals: { replies: number; failed: number; units: number };
  byModel: Array<{ model: string; replies: number; units: number }>;
  byPerson: Array<{ email: string; replies: number; units: number; limit: number | null; percent: number | null; exhausted: boolean }>;
  byChat: Array<{ conversationId: string; replies: number; units: number }>;
}
