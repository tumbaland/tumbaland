import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiKeyScope } from '@tumbaland/backend-core';
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
  register: (server: McpServer, apiKey: string) => void;
}

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
