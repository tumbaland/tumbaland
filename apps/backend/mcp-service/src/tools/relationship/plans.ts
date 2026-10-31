import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PlanInput, resolveType, tumbaland } from '../../tumbaland';
import {
  Caller,
  dateSchema,
  explain,
  fail,
  journalSchema,
  ok,
  tenantFor
} from '../module';
import { describePlan, timeSchema, remindSchema } from './format';

export function registerPlanWriteTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;
  server.registerTool(
    'plan_event',
    {
      title: 'Plan something',
      description:
        'Put something coming up in the journal’s calendar: "concert on Friday at 7", "Rome from the ' +
        '16th to the 18th". Everyone in the journal is reminded in its chat before it starts. Work out ' +
        'the date from today first and say which one you used. A place can be added in the app.',
      inputSchema: {
        title: z.string().trim().min(1).max(200).describe('What it is, in the user’s words'),
        date: dateSchema.describe('The day, or the first day of a trip'),
        endDate: dateSchema.optional().describe('The last day, for something over several days'),
        time: timeSchema.optional().describe('When it starts, 24-hour. Leave out for all day'),
        remindBefore: remindSchema.optional(),
        type: z.string().optional().describe('The activity type it is logged as afterwards, by name'),
        notes: z.string().max(1000).optional().describe('Anything else the user said about it'),
        timeZone: z.string().optional().describe('IANA zone, if the user is not in Estonia'),
        ...journalSchema(caller)
      }
    },
    async ({ title, date, endDate, time, remindBefore, type, notes, timeZone, journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const typeId = type ? resolveType(await tumbaland.listActivityTypes(apiKey, groupId), type)._id : undefined;
        const input: PlanInput = { title, date, endDate, time, remindBefore, typeId, notes, timeZone };
        const plan = await tumbaland.createPlan(apiKey, input, groupId);
        return ok(`Planned\n  ${describePlan(plan)}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
  server.registerTool(
    'edit_plan',
    {
      title: 'Change a plan',
      description:
        'Change a plan that is already in the calendar: move it, rename it, change the time or the ' +
        'reminder. Get the id from list_plans first. Only the fields you pass change. Moving it ' +
        'schedules the reminder again.',
      inputSchema: {
        id: z.string().min(1).describe('The plan to change, from list_plans'),
        title: z.string().trim().min(1).max(200).optional(),
        date: dateSchema.optional().describe('Move it to another day'),
        endDate: dateSchema.nullable().optional().describe('The last day of a trip, or null to make it one day'),
        time: timeSchema.nullable().optional().describe('A new start time, or null to make it all day'),
        remindBefore: remindSchema.optional(),
        type: z.string().optional().describe('The activity type it is logged as, by name'),
        notes: z.string().max(1000).optional(),
        ...journalSchema(caller)
      }
    },
    async ({ id, title, date, endDate, time, remindBefore, type, notes, journal }) => {
      try {
        const patch: Partial<PlanInput> = { title, date, endDate, time, remindBefore, notes };
        if (Object.values(patch).every((value) => value === undefined) && type === undefined) {
          return fail('Nothing to change. Pass at least one field to change.');
        }
        const groupId = tenantFor(caller, journal);
        if (type) patch.typeId = resolveType(await tumbaland.listActivityTypes(apiKey, groupId), type)._id;

        // Read first, so a wrong id fails before anything changes and the answer names the plan.
        const before = await tumbaland.getPlan(apiKey, id, groupId);
        const after = await tumbaland.updatePlan(apiKey, id, patch, groupId);
        return ok(`Changed\n  from ${describePlan(before)}\n  to   ${describePlan(after)}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
  server.registerTool(
    'delete_plan',
    {
      title: 'Remove a plan',
      description:
        'Take a plan out of the calendar for everyone. Get the id from list_plans first. Not undoable: ' +
        'only when the user asked for it to be removed. To move it instead, use edit_plan.',
      inputSchema: {
        id: z.string().min(1).describe('The plan to remove, from list_plans'),
        ...journalSchema(caller)
      }
    },
    async ({ id, journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const plan = await tumbaland.getPlan(apiKey, id, groupId);
        await tumbaland.deletePlan(apiKey, id, groupId);
        return ok(`Deleted\n  ${describePlan(plan)}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
}
