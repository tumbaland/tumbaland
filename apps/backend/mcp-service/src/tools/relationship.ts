import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DayEntry, activityTypeOf, resolveType, tumbaland } from '../tumbaland';
import {
  Caller,
  ToolModule,
  dateSchema,
  entrySchema,
  explain,
  fail,
  groupIdFor,
  journalSchema,
  ok,
  resolveJournal
} from './module';

/**
 * The relationship journal: the domain Tumbaland started as.
 *
 * Split read from write so a read-only key is never shown a tool it cannot use.
 * The write tools declare `relationship:read` as well, because both resolve an
 * activity type by name before writing — a write-only key would see them and
 * fail on the first call.
 */

/**
 * One entry, on one line, with the id needed to act on it.
 *
 * The id is shown rather than hidden because editing has to start somewhere: a
 * model that cannot name an entry can only rewrite the whole day, which is what
 * it was reduced to doing before `edit_activity` existed. Type *names* are still
 * resolved for the model — it should never have to invent one of those — but an
 * id it has just been handed is something it can copy back accurately.
 */
const describeActivity = (
  activity: { _id: string; date: string; description?: string; hours?: number },
  typeName: string
): string => {
  const day = activity.date.slice(0, 10);
  const time = activity.hours !== undefined ? ` (${activity.hours}h)` : '';
  const detail = activity.description ? ` — ${activity.description}` : '';
  return `- ${day}: ${typeName}${time}${detail}  [id ${activity._id}]`;
};

function registerReadTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;
  server.registerTool(
    'list_activity_types',
    {
      title: 'List activity types',
      description:
        'The kinds of thing that can be logged in this Tumbaland account, with how each is measured. ' +
        'Call this before logging anything: entries are recorded against a type, and only these exist.',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const types = await tumbaland.listActivityTypes(apiKey, groupId);
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
    'get_day',
    {
      title: 'Read one day',
      description:
        'Everything logged on one day, with the id of each entry. Call this before changing or ' +
        'removing something: edit_activity and delete_activity need an id, and this is where they ' +
        'come from. Also the right way to check what is already recorded before adding to a day.',
      inputSchema: { date: dateSchema, ...journalSchema(caller) }
    },
    async ({ date, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const [types, entries] = await Promise.all([
          tumbaland.listActivityTypes(apiKey, groupId),
          tumbaland.getDay(apiKey, date, groupId)
        ]);
        if (entries.length === 0) return ok(`Nothing logged on ${date}.`);

        const nameById = new Map(types.map((type) => [type._id, type.name]));
        const lines = entries.map((entry) =>
          describeActivity({ ...entry, date }, nameById.get(entry.typeId) ?? 'Unknown type')
        );

        return ok(`Logged on ${date}:\n${lines.join('\n')}`);
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
        limit: z.number().int().min(1).max(100).optional().describe('How many entries at most (default 20)'),
        ...journalSchema(caller)
      }
    },
    async ({ from, to, type, limit, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const types = await tumbaland.listActivityTypes(apiKey, groupId);
        // Filtered by slug, not id — the controller reads `activityType`.
        const activityType = type ? resolveType(types, type).slug : undefined;
        const nameById = new Map(types.map((entry) => [entry._id, entry.name]));

        const activities = await tumbaland.listActivities(apiKey, {
          startDate: from,
          endDate: to,
          activityType,
          limit: limit ?? 20,
          groupId
        });

        if (activities.length === 0) return ok('Nothing logged matching that.');

        const lines = activities.map((activity) =>
          describeActivity(activity, activityTypeOf(activity, nameById) ?? 'Unknown type')
        );

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
          .describe('Compare the last N days against the N before (default 30)'),
        ...journalSchema(caller)
      }
    },
    async ({ timeframe, trendWindowDays, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const [statistics, trends] = await Promise.all([
          tumbaland.getStatistics(apiKey, timeframe ?? 'all', groupId),
          tumbaland.getTrends(apiKey, trendWindowDays, groupId)
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

function registerWriteTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;
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
          .describe('Discard anything else logged that day. Destructive — only on an explicit request.'),
        ...journalSchema(caller)
      }
    },
    async ({ date, entries, replace, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const types = await tumbaland.listActivityTypes(apiKey, groupId);

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
          : (await tumbaland.getDay(apiKey, date, groupId)).map((entry) => ({
              _id: entry._id,
              typeId: entry.typeId,
              description: entry.description,
              hours: entry.hours,
              location: entry.location
            }));

        await tumbaland.saveDay(apiKey, date, [...kept, ...added], groupId);

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
        hours: entrySchema.shape.hours,
        ...journalSchema(caller)
      }
    },
    async ({ date, type, description, hours, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const types = await tumbaland.listActivityTypes(apiKey, groupId);
        const activityType = resolveType(types, type);

        await tumbaland.createActivity(
          apiKey,
          { date, typeId: activityType._id, description, hours },
          groupId
        );

        return ok(`Logged ${activityType.name} on ${date}${description ? `: ${description}` : ''}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
  server.registerTool(
    'edit_activity',
    {
      title: 'Change a logged entry',
      description:
        'Change one entry that is already logged — fix a description, correct the hours, move it to ' +
        'another day or another type. Get the id from get_day or search_activities first. Only the ' +
        'fields you pass are changed; everything else is left alone, so there is no need to restate ' +
        'the whole entry, and no need to rewrite the day around it.',
      inputSchema: {
        id: z.string().min(1).describe('The entry to change, from get_day or search_activities'),
        date: dateSchema.optional().describe('Move it to a different day'),
        type: z.string().optional().describe('Change which activity type it is recorded against, by name'),
        description: z
          .string()
          .max(500)
          .optional()
          .describe('Replace the description. Pass an empty string to clear it.'),
        hours: z.number().int().nonnegative().optional().describe('Replace the hours'),
        ...journalSchema(caller)
      }
    },
    async ({ id, date, type, description, hours, journal }) => {
      try {
        if (date === undefined && type === undefined && description === undefined && hours === undefined) {
          return fail('Nothing to change. Pass at least one of date, type, description or hours.');
        }

        const groupId = groupIdFor(resolveJournal(caller, journal));
        const types = await tumbaland.listActivityTypes(apiKey, groupId);
        const nameById = new Map(types.map((entry) => [entry._id, entry.name]));

        // Read first, so a wrong id fails before anything is written and the
        // confirmation can name what was actually touched. A model working from
        // an id it copied is one transcription away from editing the wrong
        // entry, and the only defence that works is showing the user which one.
        const before = await tumbaland.getActivity(apiKey, id, groupId);
        const beforeLine = describeActivity(before, activityTypeOf(before, nameById) ?? 'Unknown type');

        const after = await tumbaland.updateActivity(
          apiKey,
          id,
          { date, typeId: type ? resolveType(types, type)._id : undefined, description, hours },
          groupId
        );
        const afterLine = describeActivity(after, activityTypeOf(after, nameById) ?? 'Unknown type');

        return ok(`Changed\n  from ${beforeLine}\n  to   ${afterLine}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
  server.registerTool(
    'delete_activity',
    {
      title: 'Remove a logged entry',
      description:
        'Permanently remove one entry. Get the id from get_day or search_activities first. ' +
        'Destructive and not undoable — only on an explicit request to delete something. ' +
        'To correct an entry rather than remove it, use edit_activity.',
      inputSchema: {
        id: z.string().min(1).describe('The entry to remove, from get_day or search_activities'),
        ...journalSchema(caller)
      }
    },
    async ({ id, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const types = await tumbaland.listActivityTypes(apiKey, groupId);
        const nameById = new Map(types.map((entry) => [entry._id, entry.name]));

        // Read before deleting so the answer says what is gone. There is no undo
        // here, and a line the user can see is the difference between noticing
        // the wrong entry went and not.
        const activity = await tumbaland.getActivity(apiKey, id, groupId);
        const line = describeActivity(activity, activityTypeOf(activity, nameById) ?? 'Unknown type');

        await tumbaland.deleteActivity(apiKey, id, groupId);

        return ok(`Deleted\n  ${line}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
}

export const relationshipRead: ToolModule = {
  scopes: ['relationship:read'],
  register: registerReadTools
};

export const relationshipWrite: ToolModule = {
  scopes: ['relationship:read', 'relationship:write'],
  register: registerWriteTools
};
