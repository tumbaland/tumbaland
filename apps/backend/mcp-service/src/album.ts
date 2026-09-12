import { z } from 'zod';
import { callService, serviceUrl, TumbalandError } from './http';
import { parseResponse } from './schemas';

/**
 * A thin client over the album API.
 *
 * Worth knowing before reading the tools built on this: almost nothing about
 * the *content* of a photo is indexed. Across a real library of 2,600 photos
 * there is one distinct tag, nothing records what a picture shows, and no
 * photo has a resolved place name. What can be searched is the
 * album it sits in, its filename, its title if someone wrote one, and when it
 * was taken. The tools say so rather than implying a search that would quietly
 * return nothing.
 */

const albumUrl = () => serviceUrl('ALBUM');

const call = <T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> => callService<T>(albumUrl(), apiKey, method, path, body, query);

export const albumSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    photoCount: z.number().catch(0),
    totalSize: z.number().catch(0),
    createdAt: z.string().optional()
  })
  .loose();

export const albumPageSchema = z
  .object({
    albums: z.array(albumSchema),
    pagination: z.object({ total: z.number(), page: z.number(), pages: z.number() }).loose().optional()
  })
  .loose();

export const photoSchema = z
  .object({
    _id: z.string(),
    originalName: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).catch([]),
    size: z.number().catch(0),
    metadata: z
      .object({
        dateTaken: z.string().optional(),
        camera: z.object({ make: z.string().optional(), model: z.string().optional() }).loose().optional()
      })
      .loose()
      .optional()
  })
  .loose();

export const photoPageSchema = z
  .object({
    photos: z.array(photoSchema),
    pagination: z.object({ total: z.number(), page: z.number(), pages: z.number() }).loose().optional()
  })
  .loose();

/** A photo from an earlier year, as the memories endpoint returns it. */
export const memoryPhotoSchema = z
  .object({
    _id: z.string(),
    albumId: z.string(),
    albumName: z.string(),
    originalName: z.string(),
    title: z.string().optional(),
    memoryDate: z.string(),
    /** 'taken' or 'uploaded'; an upload date must never be read as a capture date */
    dateSource: z.string().catch('uploaded')
  })
  .loose();

export const memoriesSchema = z
  .object({
    date: z.string(),
    totalPhotos: z.number().catch(0),
    years: z.array(
      z
        .object({
          year: z.number(),
          yearsAgo: z.number(),
          photoCount: z.number().catch(0),
          photos: z.array(memoryPhotoSchema)
        })
        .loose()
    )
  })
  .loose();

export type Album = z.infer<typeof albumSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Memories = z.infer<typeof memoriesSchema>;

export const album = {
  listAlbums: async (
    apiKey: string,
    params: { search?: string; limit?: number; groupId?: string }
  ) => {
    const body = await call<unknown>(apiKey, 'GET', '/albums', undefined, {
      ...params,
      limit: params.limit ?? 50,
      // The cover photo means a signed URL per album, which nothing here can
      // display and which costs a round trip to the file service each.
      includeCover: false
    });
    return parseResponse(albumPageSchema, '/albums', body);
  },

  listPhotos: async (
    apiKey: string,
    albumId: string,
    params: { search?: string; tags?: string; limit?: number }
  ) => {
    const body = await call<unknown>(apiKey, 'GET', `/photos/album/${albumId}`, undefined, params);
    return parseResponse(photoPageSchema, '/photos/album/:id', body);
  },

  getMemories: async (
    apiKey: string,
    params: { windowDays?: number; limitPerYear?: number; groupId?: string }
  ): Promise<Memories> => {
    const body = await call<unknown>(apiKey, 'GET', '/photos/memories', undefined, params);
    return parseResponse(memoriesSchema, '/photos/memories', body);
  },

  albumTags: async (apiKey: string, albumId: string): Promise<unknown> =>
    call(apiKey, 'GET', `/photos/album/${albumId}/tags`),

  tagPhotos: (
    apiKey: string,
    change: { photoIds: string[]; add?: string[]; remove?: string[] }
  ): Promise<{ matched: number; modified: number }> =>
    call<{ matched: number; modified: number }>(apiKey, 'PUT', '/photos/tags', change),

  describePhoto: (
    apiKey: string,
    id: string,
    fields: { title?: string; description?: string }
  ): Promise<unknown> => call(apiKey, 'PUT', `/photos/${id}`, fields),

  getStatistics: (apiKey: string, groupId?: string): Promise<unknown> =>
    call(apiKey, 'GET', '/statistics', undefined, { groupId })
};

/**
 * Resolve an album by the name a person would say.
 *
 * Same reasoning as activity types: an assistant is told about "Spain 2024",
 * never about an ObjectId, and asking a model to carry one is asking it to
 * invent one. A miss lists the real albums, which is what gets the next attempt
 * right; matching is case-insensitive and falls back to a contains match, since
 * "Spain" should find "Spain 2024".
 */
export function resolveAlbum(albums: Album[], name: string): Album {
  const wanted = name.trim().toLowerCase();
  const exact = albums.find((entry) => entry.name.toLowerCase() === wanted);
  if (exact) return exact;

  const partial = albums.filter((entry) => entry.name.toLowerCase().includes(wanted));
  if (partial.length === 1) return partial[0];

  const available = albums.map((entry) => entry.name).join(', ') || '(none yet)';
  if (partial.length > 1) {
    throw new TumbalandError(
      `"${name}" matches more than one album: ${partial.map((entry) => entry.name).join(', ')}. Say which one.`,
      400
    );
  }
  throw new TumbalandError(`No album called "${name}". The albums are: ${available}.`, 400);
}
