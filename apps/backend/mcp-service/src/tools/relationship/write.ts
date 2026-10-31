import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DayEntry, activityTypeOf, resolveType, tumbaland } from '../../tumbaland';
import {
  Caller,
  dateSchema,
  entrySchema,
  explain,
  fail,
  journalSchema,
  ok,
  tenantFor
} from '../module';
import { describeActivity } from './format';

export function registerWriteTools(server: McpServer, caller: Caller): void {
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
        const groupId = tenantFor(caller, journal);
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
        const groupId = tenantFor(caller, journal);
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

        const groupId = tenantFor(caller, journal);
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
        const groupId = tenantFor(caller, journal);
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
