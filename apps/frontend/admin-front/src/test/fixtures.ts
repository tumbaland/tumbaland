import type { Assistants, ClaudeKey, ClaudeUsage, DeletionEntry, Deletions, Overview, UserDetail, UserList, UserRow } from '../types';

export const overview = (overrides: Partial<Overview> = {}): Overview => ({
  generatedAt: '2026-10-27T12:00:00.000Z',
  range: { from: '2026-09-28', to: '2026-10-27' },
  accounts: { total: 4, pendingDeletions: 1 },
  active: { today: 2, last7: 3, last30: 4 },
  daily: [
    { day: '2026-10-25', users: 1, visits: 1 },
    { day: '2026-10-26', users: 3, visits: 5 },
    { day: '2026-10-27', users: 2, visits: 4 }
  ],
  includesBackfilled: false,
  signups: [
    { week: '2026-10-19', users: 1 },
    { week: '2026-10-26', users: 2 }
  ],
  cohorts: [
    { week: '2026-09-28', size: 2, retention: { '1': 1, '2': 1, '4': 1, '8': null } },
    { week: '2026-10-26', size: 1, retention: { '1': null, '2': null, '4': null, '8': null } }
  ],
  opensByWeek: [
    { week: '2026-10-19', modules: { album: 3, chat: 4 } },
    { week: '2026-10-26', modules: { album: 5, relationship: 1 } }
  ],
  pairs: { total: 2, bothActiveLast7: 1 },
  assistants: { callsThisMonth: 120, tokensThisMonth: 45000, failedThisMonth: 3 },
  marketData: { used: 7, limit: 25, date: '2026-10-27' },
  ...overrides
});

export const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  createdAt: '2026-09-01T10:00:00.000Z',
  lastLoginAt: '2026-10-27T08:00:00.000Z',
  lastVisitAt: '2026-10-27T09:00:00.000Z',
  activeDays7: 4,
  activeDays30: 12,
  visits30: 30,
  topModules: [
    { module: 'album', opens: 9 },
    { module: 'relationship', opens: 3 }
  ],
  plan: { code: 'support', stale: false },
  storage: { used: 1_572_864, limit: 50 * 1024 ** 3 },
  connections: 2,
  keys: 1,
  assistantCalls30: 40,
  deletion: null,
  isAdmin: false,
  ...overrides
});

export const userList = (overrides: Partial<UserList> = {}): UserList => ({
  users: [
    userRow(),
    userRow({
      id: 'u2',
      email: 'bob@example.com',
      name: null,
      lastVisitAt: null,
      topModules: [],
      plan: { code: 'free', stale: true },
      storage: { used: 0, limit: 1024 ** 3 },
      connections: 0,
      keys: 0,
      assistantCalls30: 0,
      deletion: 'requested',
      isAdmin: true
    }),
    userRow({ id: 'u3', email: 'cleo@example.com', name: 'Cleo', deletion: 'closed' })
  ],
  total: 3,
  page: 1,
  totalPages: 1,
  ...overrides
});

export const userDetail = (overrides: Partial<UserDetail> = {}): UserDetail => ({
  user: {
    id: 'u1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    roles: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    lastLoginAt: '2026-10-27T08:00:00.000Z',
    deletion: { state: null, requestedAt: null, confirmedAt: null, confirmedBy: null }
  },
  visits: {
    from: '2026-07-30',
    to: '2026-10-27',
    days: [
      { day: '2026-10-20', visits: 1, platform: { web: 1 }, country: 'EE', backfilled: false },
      { day: '2026-10-27', visits: 3, platform: { pwa: 3 }, country: 'FI', backfilled: true }
    ],
    totalActiveDays: 4,
    firstActiveDay: '2026-07-01',
    platforms: { web: 1, pwa: 3 },
    countries: { EE: 1, FI: 1 }
  },
  modules: {
    opens: [
      { module: 'album', opens: 7 },
      { module: 'relationship', opens: 2 }
    ],
    writes: [
      { service: 'album-service', resource: 'photo', action: 'create', count: 12 },
      { service: 'relationship-service', resource: 'activity', action: 'update', count: 1 }
    ]
  },
  quota: {
    own: {
      plan: 'free',
      stale: false,
      meters: [
        { meter: 'storageBytes', label: 'Storage', unit: 'bytes', period: 'ALL', used: 500 * 1024 ** 2, limit: 1024 ** 3, metered: true },
        { meter: 'aiJobs', label: 'AI analyses', unit: 'count', period: '2026-10', used: 0, limit: 25, metered: false },
        { meter: 'seats', label: 'Group seats', unit: 'count', period: 'ALL', used: 1, limit: -1, metered: true }
      ]
    },
    pooled: [
      {
        billedTo: 'bob@example.com',
        groups: ['Ada and Bob'],
        quota: {
          plan: 'support',
          stale: true,
          meters: [{ meter: 'storageBytes', label: 'Storage', unit: 'bytes', period: 'ALL', used: 9000, limit: 50 * 1024 ** 3, metered: true }]
        }
      }
    ]
  },
  apps: {
    connections: [
      {
        clientId: 'client-claude',
        clientName: 'Claude',
        scopes: ['relationship:read'],
        tenants: ['personal'],
        grantedAt: '2026-10-01T10:00:00.000Z',
        lastUsedAt: '2026-10-26T10:00:00.000Z'
      }
    ],
    keys: [
      { name: 'Script', state: 'active', scopes: ['album:read'], tenants: ['personal'], createdAt: '2026-10-01T10:00:00.000Z', lastUsedAt: null, expiresAt: null },
      { name: 'Old', state: 'revoked', scopes: [], tenants: ['personal'], createdAt: '2026-09-01T10:00:00.000Z', lastUsedAt: null, expiresAt: '2026-12-01T10:00:00.000Z' }
    ],
    devices: [{ label: 'Safari on iOS', country: 'EE', createdAt: '2026-10-01T10:00:00.000Z', lastSeenAt: '2026-10-27T09:00:00.000Z' }]
  },
  assistants: {
    windowDays: 30,
    clients: [
      { credentialId: 'client-claude', label: 'Claude', kind: 'assistant', calls: 3, failed: 1, tokens: 500, avgMs: 200, lastAt: '2026-10-27T10:00:00.000Z' }
    ],
    tools: [{ name: 'log_day', calls: 1, failed: 0, tokens: 300, avgMs: 200 }],
    daily: [
      { day: '2026-10-26', calls: 2, tokens: 200 },
      { day: '2026-10-27', calls: 1, tokens: 300 }
    ],
    elsewhere: [
      { service: 'relationship-service', action: 'read', actorKind: 'key', count: 2 },
      { service: 'album-service', action: 'create', actorKind: 'assistant', count: 1 }
    ]
  },
  ...overrides
});

export const assistants = (overrides: Partial<Assistants> = {}): Assistants => ({
  windowDays: 30,
  totals: { calls: 4, failed: 1, tokens: 1150, accounts: 2 },
  clients: [
    { clientId: 'client-claude', name: 'Claude', connectedAccounts: 2, calls: 3, failed: 1, tokens: 1100, activeAccounts: 2, lastCallAt: '2026-10-27T10:00:00.000Z' },
    { clientId: 'quiet', name: 'Quiet App', connectedAccounts: 1, calls: 0, failed: 0, tokens: 0, activeAccounts: 0, lastCallAt: null }
  ],
  tools: [
    { name: 'log_day', calls: 1, failed: 0, failureRate: 0, tokens: 900, avgTokens: 900, avgMs: 200 },
    { name: 'get_day', calls: 3, failed: 1, failureRate: 1 / 3, tokens: 250, avgTokens: 83, avgMs: 167 }
  ],
  keys: { live: 1, actionsInWindow: 2 },
  ...overrides
});

export const deletionEntry = (overrides: Partial<DeletionEntry> = {}): DeletionEntry => ({
  id: 'd1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  requestedAt: '2026-10-20T10:00:00.000Z',
  confirmedAt: null,
  confirmedBy: null,
  lastVisitAt: '2026-10-10T09:00:00.000Z',
  visitedSinceRequest: false,
  groups: [{ name: 'Ada and partner', role: 'owner', otherMembers: ['partner@example.com'] }],
  owns: { albums: 2, photos: 42, activities: 2, storageBytes: 4200 },
  ...overrides
});

export const deletions = (overrides: Partial<Deletions> = {}): Deletions => ({
  requested: [
    deletionEntry(),
    deletionEntry({ id: 'd2', email: 'bob@example.com', name: null, visitedSinceRequest: true, groups: [], owns: { albums: 1, photos: 1, activities: 1, storageBytes: 0 } })
  ],
  closed: [
    deletionEntry({
      id: 'd3',
      email: 'dan@example.com',
      name: null,
      confirmedAt: '2026-10-22T10:00:00.000Z',
      confirmedBy: 'admin@example.com'
    })
  ],
  ...overrides
});

export const claudeKey = (overrides: Partial<ClaudeKey> = {}): ClaudeKey => ({
  configured: true,
  encryptionReady: true,
  last4: 'WXYZ',
  expiresOn: '2027-03-01',
  daysLeft: 120,
  expiringSoon: false,
  status: 'ok',
  rejectedReason: null,
  checkedAt: '2026-10-30T10:00:00.000Z',
  models: { enabled: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'], default: 'claude-sonnet-5-5' },
  catalog: [
    { id: 'claude-haiku-5-5', label: 'Fast', name: 'Haiku', hint: '', inputPerMTok: 0.1, outputPerMTok: 0.5 },
    { id: 'claude-sonnet-5-5', label: 'Balanced', name: 'Sonnet', hint: '', inputPerMTok: 2, outputPerMTok: 10 },
    { id: 'claude-opus-5-5', label: 'Best', name: 'Opus', hint: '', inputPerMTok: 4, outputPerMTok: 20 }
  ],
  botCounts: { 'claude-haiku-5-5': 0, 'claude-sonnet-5-5': 2, 'claude-opus-5-5': 1 },
  setBy: 'Ada',
  setAt: '2026-10-30T09:00:00.000Z',
  ...overrides
});

export const claudeUsage = (overrides: Partial<ClaudeUsage> = {}): ClaudeUsage => ({
  month: '2026-10',
  totals: { replies: 12, failed: 1, units: 5400 },
  byModel: [
    { model: 'claude-opus-5-5', replies: 2, units: 4000 },
    { model: 'claude-sonnet-5-5', replies: 10, units: 1400 }
  ],
  byPerson: [
    { email: 'tom@example.com', replies: 9, units: 4800, limit: 5000, percent: 96, exhausted: false },
    { email: 'irja@example.com', replies: 3, units: 600, limit: null, percent: null, exhausted: false }
  ],
  byChat: [{ conversationId: 'c1', replies: 12, units: 5400 }],
  ...overrides
});
