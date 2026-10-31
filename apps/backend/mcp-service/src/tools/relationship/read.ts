import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { activityTypeOf, resolveType, tumbaland } from '../../tumbaland';
import {
  Caller,
  ToolModule,
  dateSchema,
  explain,
  journalSchema,
  ok,
  tenantFor
} from '../module';
import { count, describeActivity, describePlan, tallinnToday } from './format';

/**
 * The relationship journal's read tools: the domain Tumbaland started as.
 *
 * Split read from write so a read-only key is never shown a tool it cannot use.
 * The write tools declare `relationship:read` as well, because both resolve an
 * activity type by name before writing — a write-only key would see them and
 * fail on the first call.
 */


export function registerReadTools(server: McpServer, caller: Caller): void {
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
        const groupId = tenantFor(caller, journal);
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
        const groupId = tenantFor(caller, journal);
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
        'Look back at what has been logged, newest first, optionally narrowed to a date range or ' +
        'one activity type. Use this to answer "when did we last…" or "how often do we…" — and ' +
        'with no date range at all to see the most recent entries, which is the fastest way to ' +
        'find something to edit.',
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
        const groupId = tenantFor(caller, journal);
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
    'list_plans',
    {
      title: 'List plans',
      description:
        'What is coming up: plans like a concert on Friday or a trip next month, with the id of ' +
        'each. With no dates, the upcoming ones from today on. Plans are separate from logged ' +
        'entries; they become entries only when someone logs them after they happened.',
      inputSchema: {
        from: dateSchema.optional().describe('First day to include. Leave out with to for the upcoming ones'),
        to: dateSchema.optional().describe('Last day to include'),
        today: dateSchema.optional().describe('Today’s date where the user is, for the upcoming ones'),
        ...journalSchema(caller)
      }
    },
    async ({ from, to, today, journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const upcoming = !from && !to;
        const plans = await tumbaland.listPlans(apiKey, {
          startDate: upcoming ? (today ?? tallinnToday()) : from,
          endDate: to,
          upcoming,
          limit: 50,
          groupId
        });
        if (plans.length === 0) return ok(upcoming ? 'Nothing planned from today on.' : 'No plans in those days.');
        return ok(plans.map(describePlan).join('\n'));
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
        const groupId = tenantFor(caller, journal);
        const [statistics, trends] = await Promise.all([
          tumbaland.getStatistics(apiKey, timeframe ?? 'all', groupId),
          tumbaland.getTrends(apiKey, trendWindowDays, groupId)
        ]);

        const period = timeframe && timeframe !== 'all' ? `over the last ${timeframe}` : 'in total';
        const since =
          statistics.firstEntryDate
            ? ` since ${statistics.firstEntryDate.slice(0, 10)}` +
              (statistics.daysSinceFirstEntry ? ` (${statistics.daysSinceFirstEntry} days)` : '')
            : '';

        const lines: string[] = [
          `${count(statistics.totalActivities ?? 0)} entries ${period}${since}` +
            (statistics.totalHours ? `, ${count(statistics.totalHours)} hours logged` : '') +
            '.'
        ];

        if (statistics.types.length > 0) {
          lines.push(
            '',
            'By type:',
            ...statistics.types.map((type) => {
              const days = type.uniqueDays === undefined ? '' : ` on ${type.uniqueDays} days`;
              // Hours only where a type is measured in them. Most are not, and
              // "0h" against every one of them reads as a real zero.
              const hours = type.totalHours ? `, ${type.totalHours}h` : '';
              return `- ${type.name}: ${count(type.count)} entries${days}${hours}`;
            })
          );
        }

        const window = trends.windowDays ?? 30;
        const totals = trends.totals;
        if (totals) {
          const span =
            trends.currentStart && trends.currentEnd
              ? ` (${trends.currentStart} to ${trends.currentEnd})`
              : '';
          const change = (value: number | null | undefined): string =>
            value === null || value === undefined ? '' : ` (${value >= 0 ? '+' : ''}${value}%)`;
          lines.push(
            '',
            `Last ${window} days${span} against the ${window} before: ` +
              `${totals.current.entries} entries vs ${totals.previous.entries}${change(totals.entriesChangePct)}, ` +
              `${totals.current.hours ?? 0}h vs ${totals.previous.hours ?? 0}h${change(totals.hoursChangePct)}, ` +
              `active on ${totals.current.activeDays ?? 0} days vs ${totals.previous.activeDays ?? 0}.` +
              (totals.direction ? ` Overall ${totals.direction}.` : '')
          );
        }

        if (trends.types.length > 0) {
          lines.push(
            '',
            'What moved:',
            ...trends.types.map((type) => {
              const shift =
                type.entriesChangePct === null || type.entriesChangePct === undefined
                  ? ''
                  : ` (${type.entriesChangePct >= 0 ? '+' : ''}${type.entriesChangePct}%)`;
              return (
                `- ${type.name}: ${type.current.entries} vs ${type.previous.entries} entries${shift}` +
                (type.direction ? `, ${type.direction}` : '')
              );
            })
          );
        }

        return ok(lines.join('\n'));
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
