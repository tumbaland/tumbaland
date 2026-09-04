import { z } from 'zod';

/**
 * What the relationship API actually returns, checked at the boundary.
 *
 * Four separate bugs in this integration came from the same thing: the client
 * assumed a shape, the tests mocked that same assumed shape, and the two agreed
 * with each other while disagreeing with the service. A bare array where a named
 * collection was returned, `from`/`to` where `startDate`/`endDate` was read, a
 * `typeId` that arrives populated on one endpoint and as an id on another —
 * every one of them produced a plausible answer rather than an error, which is
 * the worst way for a mistake to present.
 *
 * Parsing here turns the next such drift into a message naming the field,
 * raised on the first call, instead of a search that quietly returns the wrong
 * rows. These schemas were derived from live responses, not from reading the
 * controllers — the mistake the first four had in common.
 */

/** Every list endpoint answers with a named collection plus pagination. */
const pagination = z
  .object({
    page: z.number().optional(),
    limit: z.number().optional(),
    total: z.number().optional(),
    totalPages: z.number().optional()
  })
  .loose();

export const activityTypeSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    slug: z.string(),
    valueType: z.enum(['string', 'boolean', 'number']).catch('string'),
    hasLocation: z.boolean().catch(false),
    color: z.string().optional(),
    /** absent on a personal type; the group listing returns both kinds */
    groupId: z.string().optional()
  })
  .loose();

export const activityTypesResponseSchema = z
  .object({
    types: z.array(activityTypeSchema),
    pagination: pagination.optional()
  })
  .loose();

/**
 * `typeId` is the whole type document on `/activities` and a bare id on
 * `/days`. Both are accepted because both are real; a caller that wants the
 * name goes through `activityTypeOf` rather than guessing which it got.
 */
export const activitySchema = z
  .object({
    _id: z.string(),
    date: z.string(),
    typeId: z.union([z.string(), activityTypeSchema]),
    description: z.string().optional(),
    hours: z.number().optional(),
    location: z
      .object({ label: z.string(), lat: z.number(), lng: z.number() })
      .loose()
      .optional()
  })
  .loose();

/** One activity, as the by-id and write endpoints answer with it. */
export const activityResponseSchema = activitySchema;

export const activitiesResponseSchema = z
  .object({
    activities: z.array(activitySchema),
    pagination: pagination.optional()
  })
  .loose();

/** A day's stored entries. `_id` is what marks one as an entry to keep. */
export const dayEntrySchema = z
  .object({
    _id: z.string(),
    typeId: z.string(),
    description: z.string().optional(),
    hours: z.number().optional(),
    location: z
      .object({ label: z.string(), lat: z.number(), lng: z.number() })
      .loose()
      .optional()
  })
  .loose();

export const daysResponseSchema = z
  .object({
    days: z.array(z.object({ date: z.string(), entries: z.array(dayEntrySchema) }).loose())
  })
  .loose();

/**
 * A response that did not look the way this client expects.
 *
 * Named separately from a transport failure because the two need different
 * responses: a 500 is worth retrying, a changed contract is not.
 */
export class ShapeError extends Error {
  constructor(
    readonly path: string,
    readonly detail: string
  ) {
    super(
      `The response from ${path} was not the shape this server expects (${detail}). ` +
        'The Tumbaland API has probably changed; this is a bug to report rather than something to retry.'
    );
    this.name = 'ShapeError';
  }
}

/** Parse, or fail with something a person can act on. */
export function parseResponse<T>(schema: z.ZodType<T>, path: string, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ShapeError(path, `${where}: ${issue.message}`);
}
