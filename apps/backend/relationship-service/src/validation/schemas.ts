import { z } from 'zod';
import { DAY_PATTERN, parseDay } from '../utils/day';
import { TIME_PATTERN, isValidTimeZone } from '../utils/time';

/** Where an entry happened; only accepted for types with hasLocation. */
export const locationSchema = z.object({
  label: z.string().trim().min(1, 'A place needs a name').max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

/**
 * A real calendar day as YYYY-MM-DD, stored as its UTC midnight. Stricter than
 * `z.coerce.date`, which takes any timestamp and rolls 2026-02-31 into March.
 */
const daySchema = z
  .string({ error: 'A valid date is required' })
  .regex(DAY_PATTERN, 'Date must be formatted as YYYY-MM-DD')
  .transform((day, ctx) => {
    const date = parseDay(day);
    if (!date) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return date;
  });

export const createActivitySchema = z.object({
  date: daySchema,
  typeId: z.string().min(1, 'typeId is required'),
  description: z.string().max(500).optional(),
  hours: z.number().int().nonnegative().optional(),
  location: locationSchema.optional(),
  groupId: z.string().optional()
});

export const updateActivitySchema = createActivitySchema.partial();

export const saveDashboardSettingsSchema = z.object({
  highlightTypeIds: z.array(z.string()).max(20),
  hiddenTypeIds: z.array(z.string()).max(50),
  // '' and null both mean "no override" — the service clears the stored value.
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be formatted as YYYY-MM-DD')
    .or(z.literal(''))
    .nullish(),
  groupId: z.string().optional()
});

export const saveDaySchema = z.object({
  entries: z.array(z.object({
    _id: z.string().optional(),
    typeId: z.string().min(1, 'typeId is required'),
    description: z.string().max(500).optional(),
    hours: z.number().int().nonnegative().optional(),
    location: locationSchema.nullish()
  })),
  groupId: z.string().optional()
});

export const createActivityTypeSchema = z.object({
  name: z.string().trim().min(1, 'Missing required field: name is required').max(50),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional(),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code (e.g., #FF5733)').optional(),
  icon: z.string().max(50).optional(),
  valueType: z.enum(['string', 'boolean', 'number']).optional(),
  hasLocation: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  groupId: z.string().optional()
});

export const updateActivityTypeSchema = createActivityTypeSchema.partial();

export const reorderActivityTypesSchema = z.object({
  typeIds: z.array(z.string()),
  groupId: z.string().optional()
});

/** Minutes before a plan to remind, up to a month; null for none. */
const remindBeforeSchema = z.number().int().min(0).max(43_200).nullable();

const planFields = {
  title: z.string().trim().min(1, 'A plan needs a name').max(200),
  date: daySchema,
  // the last day of a trip; null or absent for one day
  endDate: daySchema.nullish(),
  // null or absent: all day
  time: z.string().regex(TIME_PATTERN, 'Time must be formatted as HH:mm').nullish(),
  timeZone: z.string().max(64).refine(isValidTimeZone, 'Unknown time zone').optional(),
  notes: z.string().max(1000).optional(),
  typeId: z.string().min(1).nullish(),
  location: locationSchema.nullish(),
  remindBefore: remindBeforeSchema.optional()
};

/** A trip ends on or after the day it starts. */
const endsAfterStart = (plan: { date?: Date; endDate?: Date | null }) =>
  !plan.date || !plan.endDate || plan.endDate >= plan.date;

export const createPlanSchema = z
  .object({ ...planFields, groupId: z.string().optional() })
  .refine(endsAfterStart, { message: 'A plan ends on or after the day it starts', path: ['endDate'] });

// A plan stays in the scope it was made in.
export const updatePlanSchema = z
  .object(planFields)
  .partial()
  .refine(endsAfterStart, { message: 'A plan ends on or after the day it starts', path: ['endDate'] });

export const logPlanSchema = z.object({
  typeId: z.string().min(1).optional()
});
