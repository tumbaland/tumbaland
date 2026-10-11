import { z } from 'zod';
import { callService, serviceUrl, TumbalandError } from './http';
import { parseResponse } from './schemas';

/**
 * A thin client over album-service's collage API, and the two pictures it
 * draws for an assistant: a collage, and a page of an album.
 *
 * A collage's config is kept as the editor stored it and read with
 * @tumbaland/collage-core, the same code the editor reads it with, so nothing
 * here has its own idea of what a collage is.
 */

const call = <T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> => callService<T>(serviceUrl('ALBUM'), apiKey, method, path, body, query);

export const collageSchema = z
  .object({
    _id: z.string(),
    title: z.string(),
    albumIds: z.array(z.string()).catch([]),
    config: z.record(z.string(), z.unknown()).catch({}),
    // Personal collages may carry a stored null, which the list now returns.
    groupId: z.string().nullish(),
    madeBy: z.object({ kind: z.literal('assistant'), label: z.string().catch('An assistant') }).loose().optional(),
    revision: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
  })
  .loose();

/** A photo the collage can use: every photo in its albums. */
export const collagePhotoSchema = z
  .object({
    _id: z.string(),
    filename: z.string().catch(''),
    originalName: z.string().optional(),
    title: z.string().optional(),
    dateTaken: z.string().optional(),
    mimetype: z.string().catch('image/jpeg'),
    width: z.number().optional(),
    height: z.number().optional(),
    tags: z.array(z.string()).catch([])
  })
  .loose();

/**
 * Each photo read on its own: one that does not fit is left out, rather than
 * one odd record emptying the list and every photo reading as "not in this
 * collage's albums".
 */
const collagePhotosSchema = z
  .array(z.unknown())
  .catch([])
  .transform((photos) =>
    photos.flatMap((photo) => {
      const parsed = collagePhotoSchema.safeParse(photo);
      return parsed.success ? [parsed.data] : [];
    })
  );

export const collageWithPhotosSchema = z
  .object({ collage: collageSchema, photos: collagePhotosSchema })
  .loose();

export const imageSchema = z
  .object({ image: z.string(), mimeType: z.string(), width: z.number(), height: z.number() })
  .loose();

export const sheetSchema = imageSchema
  .extend({
    page: z.number(),
    pages: z.number(),
    total: z.number(),
    photos: z.array(
      z
        .object({
          n: z.number(),
          id: z.string(),
          name: z.string(),
          dateTaken: z.string().optional(),
          aspect: z.number().optional(),
          mimetype: z.string().catch('image/jpeg'),
          tags: z.array(z.string()).catch([])
        })
        .loose()
    )
  })
  .loose();

export type Collage = z.infer<typeof collageSchema>;
export type CollagePhoto = z.infer<typeof collagePhotoSchema>;
export type CollageWithPhotos = z.infer<typeof collageWithPhotosSchema>;
export type EncodedImage = z.infer<typeof imageSchema>;
export type ContactSheet = z.infer<typeof sheetSchema>;

/** One small change to a collage, as album-service's changes route takes it. */
export type CollageChange =
  | { type: 'put'; layer: 'photos' | 'texts'; item: { id: string } & Record<string, unknown>; index?: number }
  | { type: 'remove'; layer: 'photos' | 'texts'; id: string }
  | { type: 'order'; layer: 'photos' | 'texts'; ids: string[] }
  | { type: 'settings'; values: Record<string, unknown> };

export const collages = {
  list: async (apiKey: string, params: { groupId?: string }): Promise<Collage[]> => {
    const body = await call<unknown>(apiKey, 'GET', '/collages', undefined, params);
    return parseResponse(z.array(collageSchema), '/collages', body);
  },

  get: async (apiKey: string, id: string): Promise<CollageWithPhotos> => {
    // Nothing here draws the photos, so their signed links (three per photo of
    // every album the collage uses) are not asked for.
    const body = await call<unknown>(apiKey, 'GET', `/collages/${id}`, undefined, { urls: 0 });
    return parseResponse(collageWithPhotosSchema, '/collages/:id', body);
  },

  preview: async (apiKey: string, id: string, params: { width?: number; outline?: boolean }): Promise<EncodedImage> => {
    const body = await call<unknown>(apiKey, 'GET', `/collages/${id}/preview`, undefined, {
      width: params.width,
      outline: params.outline ? 1 : undefined
    });
    return parseResponse(imageSchema, '/collages/:id/preview', body);
  },

  sheet: async (
    apiKey: string,
    albumId: string,
    params: { page?: number; size?: number; tag?: string; from?: string; to?: string }
  ): Promise<ContactSheet> => {
    const body = await call<unknown>(apiKey, 'GET', `/photos/album/${albumId}/sheet`, undefined, params);
    return parseResponse(sheetSchema, '/photos/album/:id/sheet', body);
  },

  create: async (
    apiKey: string,
    input: { title: string; albumIds: string[]; config: unknown; groupId?: string }
  ): Promise<Collage> => {
    const body = await call<unknown>(apiKey, 'POST', '/collages', input);
    return parseResponse(collageSchema, 'POST /collages', body);
  },

  change: (apiKey: string, id: string, changes: CollageChange[]): Promise<{ revision: number }> =>
    call<{ revision: number }>(apiKey, 'POST', `/collages/${id}/changes`, { changes })
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Resolve a collage by the name a person would say, or by its id.
 *
 * Same reasoning as albums: a person says "the Rome one". A miss lists the
 * real titles, which is what gets the next attempt right.
 */
export function resolveCollage(list: Collage[], name: string): Collage {
  const wanted = name.trim().toLowerCase();
  if (OBJECT_ID.test(wanted)) {
    const byId = list.find((entry) => entry._id.toLowerCase() === wanted);
    if (byId) return byId;
  }

  const exact = list.filter((entry) => entry.title.toLowerCase() === wanted);
  if (exact.length === 1) return exact[0]!;

  const partial = exact.length > 1 ? exact : list.filter((entry) => entry.title.toLowerCase().includes(wanted));
  if (partial.length === 1) return partial[0]!;

  if (partial.length > 1) {
    const names = partial.map((entry) => `"${entry.title}" (id ${entry._id})`).join(', ');
    throw new TumbalandError(`"${name}" matches more than one collage: ${names}. Say which one, by id if they share a name.`, 400);
  }
  const available = list.map((entry) => `"${entry.title}"`).join(', ') || '(none yet)';
  throw new TumbalandError(`No collage called "${name}". The collages are: ${available}.`, 400);
}
