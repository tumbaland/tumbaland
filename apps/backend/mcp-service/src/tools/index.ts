import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DayEntry, TumbalandError, resolveType, tumbaland } from '../tumbaland';

/**
 * The tool surface.
 *
 * Deliberately small. Tumbaland exposes ~30 relationship routes, and handing a
 * model one tool per route would bury the two it actually needs under a pile of
 * near-synonyms. These are shaped around what someone says out loud — "we went
 * out on Saturday", "how have we been doing lately" — not around the REST verbs
 * underneath.
 */

/** A day as people write it, and as every endpoint here expects it. */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('The day, as YYYY-MM-DD');

const entrySchema = z.object({
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
const fail = (message: string) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: message }]
});

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

/**
 * Turn any failure into a sentence.
 *
 * A model cannot recover from a stack trace, and a raw 403 tells it nothing
 * about what to do differently. Scope failures in particular are worth naming
 * precisely: the fix is a new key, not a retry, and a model that is told to
 * retry will keep trying.
 */
function explain(error: unknown): ReturnType<typeof fail> {
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

export function registerTools(server: McpServer, apiKey: string): void {
  server.registerTool(
    'list_activity_types',
    {
      title: 'List activity types',
      description:
        'The kinds of thing that can be logged in this Tumbaland account, with how each is measured. ' +
        'Call this before logging anything: entries are recorded against a type, and only these exist.',
      inputSchema: {}
    },
    async () => {
      try {
        const types = await tumbaland.listActivityTypes(apiKey);
        if (types.length === 0) {
          return ok('No activity types are defined yet. The user needs to create some in Tumbaland first.');
        }

        const lines = types.map((type) => {
          const measure =
            type.valueType === 'number'
              ? 'takes a number of hours'
              : type.valueType === 'boolean'
                ? 'just marks that it happened'
                : 'takes a short description';
          return `- ${type.name} (${measure}${type.hasLocation ? ', can carry a place' : ''})`;
        });

        return ok(`Activity types in this account:\n${lines.join('\n')}`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'log_day',
    {
      title: 'Log a day',
      description:
        'Record what happened on one day. This is the right tool for "on Saturday we had dinner ' +
        'and watched a film". Entries are added to whatever is already logged for that day, so you ' +
        'do not need to know what is there — set replace to true only if the user says the day ' +
        'should be exactly this and nothing else.',
      inputSchema: {
        date: dateSchema,
        entries: z.array(entrySchema).min(1).describe('What happened that day'),
        replace: z
          .boolean()
          .optional()
          .describe('Discard anything else logged that day. Destructive — only on an explicit request.')
      }
    },
    async ({ date, entries, replace }) => {
      try {
        const types = await tumbaland.listActivityTypes(apiKey);

        // Names resolve to ids here so the model never sees an ObjectId, and an
        // unknown name fails before anything is written.
        const added: DayEntry[] = entries.map((entry) => ({
          typeId: resolveType(types, entry.type)._id,
          description: entry.description,
          hours: entry.hours
        }));

        // The underlying endpoint is the day editor's save: it deletes whatever
        // is not in the list. That is right for a person looking at the whole
        // day and wrong for an agent that cannot see it — asked to "add a walk
        // on Saturday" it would send one entry and silently wipe the dinner.
        // So existing entries are read back and carried through by `_id`, and
        // the destructive behaviour needs an explicit ask.
        const kept: DayEntry[] = replace
          ? []
          : (await tumbaland.getDay(apiKey, date)).map((entry) => ({
              _id: entry._id,
              typeId: entry.typeId,
              description: entry.description,
              hours: entry.hours,
              location: entry.location
            }));

        await tumbaland.saveDay(apiKey, date, [...kept, ...added]);

        const summary = entries
          .map((entry) => (entry.description ? `${entry.type} (${entry.description})` : entry.type))
          .join(', ');
        const note = replace
          ? ' (replaced everything else that day)'
          : kept.length > 0
            ? `, alongside ${kept.length} already logged`
            : '';
        return ok(`Logged on ${date}: ${summary}${note}`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'log_activity',
    {
      title: 'Log a single activity',
      description:
        'Add one entry on a date, leaving anything else already recorded that day untouched. ' +
        'Prefer log_day when describing a whole day; use this to add a single thing.',
      inputSchema: {
        date: dateSchema,
        type: entrySchema.shape.type,
        description: entrySchema.shape.description,
        hours: entrySchema.shape.hours
      }
    },
    async ({ date, type, description, hours }) => {
      try {
        const types = await tumbaland.listActivityTypes(apiKey);
        const activityType = resolveType(types, type);

        await tumbaland.createActivity(apiKey, {
          date,
          typeId: activityType._id,
          description,
          hours
        });

        return ok(`Logged ${activityType.name} on ${date}${description ? `: ${description}` : ''}`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'search_activities',
    {
      title: 'Search logged activities',
      description:
        'Look back at what has been logged, optionally narrowed to a date range or one activity type. ' +
        'Use this to answer "when did we last…" or "how often do we…".',
      inputSchema: {
        from: dateSchema.optional().describe('Earliest day to include'),
        to: dateSchema.optional().describe('Latest day to include'),
        type: z.string().optional().describe('Narrow to one activity type, by name'),
        limit: z.number().int().min(1).max(100).optional().describe('How many entries at most (default 20)')
      }
    },
    async ({ from, to, type, limit }) => {
      try {
        const types = await tumbaland.listActivityTypes(apiKey);
        const typeId = type ? resolveType(types, type)._id : undefined;
        const nameById = new Map(types.map((activityType) => [activityType._id, activityType.name]));

        const activities = await tumbaland.listActivities(apiKey, {
          from,
          to,
          typeId,
          limit: limit ?? 20
        });

        if (activities.length === 0) return ok('Nothing logged matching that.');

        const lines = activities.map((activity) => {
          const day = activity.date.slice(0, 10);
          const name = nameById.get(activity.typeId) ?? 'Unknown type';
          const detail = activity.description ? ` — ${activity.description}` : '';
          const time = activity.hours !== undefined ? ` (${activity.hours}h)` : '';
          return `- ${day}: ${name}${time}${detail}`;
        });

        return ok(lines.join('\n'));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'get_stats',
    {
      title: 'Get statistics and trends',
      description:
        'Totals across the account, and whether each activity type is picking up or fading compared ' +
        'with the previous period. Use for "how have we been doing lately".',
      inputSchema: {
        timeframe: z
          .enum(['week', 'month', 'quarter', 'year', 'all'])
          .optional()
          .describe('Period for the totals (default all)'),
        trendWindowDays: z
          .number()
          .int()
          .min(7)
          .max(180)
          .optional()
          .describe('Compare the last N days against the N before (default 30)')
      }
    },
    async ({ timeframe, trendWindowDays }) => {
      try {
        const [statistics, trends] = await Promise.all([
          tumbaland.getStatistics(apiKey, timeframe ?? 'all'),
          tumbaland.getTrends(apiKey, trendWindowDays)
        ]);

        // Returned as JSON rather than prose: these are numbers the model will
        // want to quote and compare, and re-describing them here would only add
        // a layer to be wrong in.
        return ok(JSON.stringify({ statistics, trends }, null, 2));
      } catch (error) {
        return explain(error);
      }
    }
  );
}
