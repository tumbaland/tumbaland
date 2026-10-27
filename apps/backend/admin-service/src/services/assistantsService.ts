import { ApiKey, AuditEvent, OAuthClient, RefreshToken } from '@tumbaland/backend-core';
import { shiftDay, startOfDay, toDay } from './dates';

export interface Assistants {
  windowDays: number;
  totals: { calls: number; failed: number; tokens: number; accounts: number };
  /** Every registered app, with how many accounts are connected to it and what it did. */
  clients: Array<{
    clientId: string;
    name: string;
    connectedAccounts: number;
    calls: number;
    failed: number;
    tokens: number;
    /** Accounts it made a call for in the window. */
    activeAccounts: number;
    lastCallAt: string | null;
  }>;
  /** Most tokens first: the tool whose answers are worth making smaller is at the top. */
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

/**
 * What connected assistants did, across every account.
 *
 * Built from the MCP tool-call rows, which hold a tool's name, how long it took
 * and roughly how many tokens it handed the model, and nothing of what it was
 * asked or answered. The "tokens" are the estimate the rows carry (four
 * characters to a token), good for finding the expensive tool and not for
 * reconciling a bill.
 */
export async function getAssistants({ days = 30, now = new Date() }: { days?: number; now?: Date } = {}): Promise<Assistants> {
  const since = startOfDay(shiftDay(toDay(now), -(days - 1)));
  const calls = { action: 'call', service: 'mcp-service', at: { $gte: since } };

  const [byClient, tools, totals, connected, registered, liveKeys, keyActions] = await Promise.all([
    AuditEvent.aggregate<{
      _id: string | null;
      calls: number;
      failed: number;
      tokens: number;
      accounts: string[];
      lastAt: Date;
      label: string;
    }>([
      { $match: { ...calls, actorKind: 'assistant' } },
      // `$last` below means the newest label only if the rows arrive in order.
      { $sort: { at: 1 } },
      {
        $group: {
          _id: '$actorCredentialId',
          label: { $last: '$actorLabel' },
          calls: { $sum: 1 },
          failed: { $sum: { $cond: ['$tool.failed', 1, 0] } },
          tokens: { $sum: '$tool.tokens' },
          accounts: { $addToSet: '$userId' },
          lastAt: { $max: '$at' }
        }
      }
    ]),
    AuditEvent.aggregate<{ _id: string; calls: number; failed: number; tokens: number; avgMs: number }>([
      { $match: calls },
      {
        $group: {
          _id: '$tool.name',
          calls: { $sum: 1 },
          failed: { $sum: { $cond: ['$tool.failed', 1, 0] } },
          tokens: { $sum: '$tool.tokens' },
          avgMs: { $avg: '$tool.ms' }
        }
      },
      { $sort: { tokens: -1 } },
      { $limit: 25 }
    ]),
    AuditEvent.aggregate<{ calls: number; failed: number; tokens: number; accounts: string[] }>([
      { $match: calls },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          failed: { $sum: { $cond: ['$tool.failed', 1, 0] } },
          tokens: { $sum: '$tool.tokens' },
          accounts: { $addToSet: '$userId' }
        }
      }
    ]),
    RefreshToken.aggregate<{ _id: string; accounts: string[] }>([
      { $match: { revokedAt: { $exists: false } } },
      { $group: { _id: '$clientId', accounts: { $addToSet: '$userId' } } }
    ]),
    OAuthClient.find({}).select('clientId clientName').lean(),
    ApiKey.countDocuments({
      revokedAt: { $exists: false },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }]
    }),
    AuditEvent.countDocuments({ actorKind: 'key', at: { $gte: since } })
  ]);

  const connectedBy = new Map(connected.map((row) => [row._id, row.accounts.length]));
  const usageBy = new Map(byClient.map((row) => [row._id ?? '', row]));
  const ids = new Set<string>([...registered.map((client) => client.clientId), ...usageBy.keys()].filter(Boolean));
  const nameOf = new Map(registered.map((client) => [client.clientId, client.clientName]));

  const clients = [...ids]
    .map((clientId) => {
      const usage = usageBy.get(clientId);
      return {
        clientId,
        name: nameOf.get(clientId) ?? usage?.label ?? 'Unknown app',
        connectedAccounts: connectedBy.get(clientId) ?? 0,
        calls: usage?.calls ?? 0,
        failed: usage?.failed ?? 0,
        tokens: usage?.tokens ?? 0,
        activeAccounts: usage?.accounts.length ?? 0,
        lastCallAt: usage?.lastAt.toISOString() ?? null
      };
    })
    .sort((a, b) => b.calls - a.calls || b.connectedAccounts - a.connectedAccounts);

  const total = totals[0];
  return {
    windowDays: days,
    totals: {
      calls: total?.calls ?? 0,
      failed: total?.failed ?? 0,
      tokens: total?.tokens ?? 0,
      accounts: total?.accounts.length ?? 0
    },
    clients,
    tools: tools.map((row) => ({
      name: row._id,
      calls: row.calls,
      failed: row.failed,
      failureRate: row.calls === 0 ? 0 : row.failed / row.calls,
      tokens: row.tokens,
      avgTokens: row.calls === 0 ? 0 : Math.round(row.tokens / row.calls),
      avgMs: Math.round(row.avgMs ?? 0)
    })),
    keys: { live: liveKeys, actionsInWindow: keyActions }
  };
}
