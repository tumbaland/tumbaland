import { z } from 'zod';

/** Where an entry happened; only accepted for types with hasLocation. */
export const locationSchema = z.object({
  label: z.string().trim().min(1, 'A place needs a name').max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const createActivitySchema = z.object({
  date: z.coerce.date({ error: 'A valid date is required' }),
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
