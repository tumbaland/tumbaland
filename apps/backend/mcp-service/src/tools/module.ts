import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PERSONAL_TENANT, type ActorKind, type ApiKeyScope, type Tenant } from '@tumbaland/backend-core';
import { TumbalandError } from '../tumbaland';

/**
 * A tool, and what a key must carry before the model is told it exists.
 *
 * Scopes gate *registration*, not execution. A key without `relationship:write`
 * should never see `log_day` at all: a tool the model can see is a tool it will
 * try, and a 403 it cannot act on is worse than an absence it can reason about.
 * This is also the seam new domains hang off — album and finance become modules
 * that declare their own scopes and nothing else changes.
 */
export interface ToolModule {
  /** every one of these must be present on the key */
  scopes: ApiKeyScope[];
  register: (server: McpServer, caller: Caller) => void;
}

/**
 * Who is calling, and which data they may reach.
 *
 * A credential can now be granted more than one tenant — a shared journal and
 * the owner's own data, say — so the tenant is no longer a fixed property of
 * the connection that the tools can ignore. It is settled per call, from this.
 */
export interface Caller {
  /** the credential, forwarded verbatim to the services */
  token: string;
  /** every tenant it may act in, and the one it acts in unasked */
  tenants: { allowed: Tenant[]; default: Tenant };
  /** what each of those is called, as the user saw them when approving */
  tenantNames: Record<Tenant, string>;
  /**
   * Who to attribute a tool call to in the audit trail.
   *
   * Separate from the token because the token is a secret to forward and this
   * is a name to write down. Optional so a test can build a caller without
   * inventing an identity for it — a call with no actor is timed and logged,
   * just not filed under anyone.
   */
  actor?: {
    kind: ActorKind;
    userId: string;
    /** the key's name or the app's, as the user would recognise it */
    label: string;
    credentialId?: string;
  };
}

/** What a tenant should be called, falling back to something legible. */
export const tenantLabel = (caller: Caller, tenant: Tenant): string =>
  caller.tenantNames[tenant] ?? (tenant === PERSONAL_TENANT ? 'My own data' : `Group ${tenant.slice(-6)}`);

/**
 * The `journal` parameter, or nothing at all.
 *
 * Only offered when the credential reaches more than one tenant. A model shown
 * a choice it cannot get wrong is a model that will eventually get it wrong, so
 * a single-tenant connection is not told that tenants exist — which is exactly
 * how every connection behaved before they could hold more than one.
 */
export const journalSchema = (caller: Caller): { journal: z.ZodOptional<z.ZodString> } => {
  // Genuinely absent for a single-tenant caller, and typed as present so the
  // spread into a tool's shape stays a literal that Zod can infer from. The
  // handler reads `journal` as undefined in that case, which is exactly what an
  // unsupplied optional parameter would give it.
  if (caller.tenants.allowed.length < 2) {
    return {} as { journal: z.ZodOptional<z.ZodString> };
  }

  const labels = caller.tenants.allowed.map((tenant) => tenantLabel(caller, tenant));
  return {
    journal: z
      .string()
      .optional()
      .describe(
        `Whose journal to use: ${labels.join(' or ')}. ` +
          `Defaults to ${tenantLabel(caller, caller.tenants.default)}. ` +
          'Ask the user which one they mean rather than guessing when it matters.'
      )
  };
};

/**
 * Resolve what the model named to the tenant a request should carry.
 *
 * Matching is on the name a person saw and approved, not on an id — the same
 * reasoning as activity types. A miss throws with the real options rather than
 * silently falling back to the default, because writing an entry into the wrong
 * journal is not a failure anyone would notice.
 */
export function resolveJournal(caller: Caller, journal?: string): Tenant {
  if (!journal) return caller.tenants.default;

  const wanted = journal.trim().toLowerCase();
  const match = caller.tenants.allowed.find(
    (tenant) => tenantLabel(caller, tenant).toLowerCase() === wanted || tenant.toLowerCase() === wanted
  );

  if (!match) {
    const available = caller.tenants.allowed.map((t) => tenantLabel(caller, t)).join(', ');
    throw new TumbalandError(
      `This connection cannot reach a journal called "${journal}". It has access to: ${available}.`,
      403
    );
  }

  return match;
}

/** The `groupId` a resolved tenant travels as; personal travels as nothing. */
export const groupIdFor = (tenant: Tenant): string | undefined =>
  tenant === PERSONAL_TENANT ? undefined : tenant;

/** A day as people write it, and as every endpoint here expects it. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('The day, as YYYY-MM-DD');

export const entrySchema = z.object({
  type: z.string().describe('Activity type by name, e.g. "Dinner" — call list_activity_types first'),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('What it was: which restaurant, which film. For types that take text.'),
  hours: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Whole hours, for types measured in time')
});

/** Everything the model gets back on failure is text it can act on. */
export const fail = (message: string) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: message }]
});

export const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

/**
 * Turn any failure into a sentence.
 *
 * A model cannot recover from a stack trace, and a raw 403 tells it nothing
 * about what to do differently. Scope failures in particular are worth naming
 * precisely: the fix is a new key, not a retry, and a model that is told to
 * retry will keep trying.
 */
export function explain(error: unknown): ReturnType<typeof fail> {
  if (error instanceof TumbalandError) {
    if (error.status === 403) {
      return fail(
        `${error.message} This API key does not carry the permission for that. ` +
          'Do not retry — the user needs to issue a new key with the right scope in Tumbaland account settings.'
      );
    }
    if (error.status === 401) {
      return fail('The API key was rejected. Do not retry; the user needs to check or reissue it.');
    }
    return fail(error.message);
  }
  return fail(error instanceof Error ? error.message : 'Unknown error');
}
