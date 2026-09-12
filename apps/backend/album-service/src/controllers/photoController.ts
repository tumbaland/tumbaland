import { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError, sendSuccess, countRead } from '@tumbaland/backend-core';
import photoService from '../services/photoService';
import memoriesService from '../services/memoriesService';
import { getUploadSignedUrl, generateFileId } from '../services/fileServiceClient';
import { assertStorageHeadroom, recordStoredBytes, releaseStoredBytes, storageActor } from '../services/storageUsage';
import Album from '../models/Album';

/**
 * Accepts both `?tags=a,b` and repeated `?tags=a&tags=b`, since the two forms
 * are equally natural to build on the client.
 */
const parseTagsParam = (raw: unknown): string[] | undefined => {
  if (raw === undefined || raw === null) return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const tags = values
    .flatMap((value) => String(value).split(','))
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
};

/**
 * Create a new photo record
 */
export const createPhoto = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const album = await Album.findById(req.body.albumId);

  const photo = await photoService.createPhoto(req.body, user.id, album?.groupId);

  // The bytes are already in MinIO by now — the quota gate ran back at the
  // signed-URL request — so this records rather than re-checks. `createPhoto`
  // throws when the album is missing, so reaching here means `album` exists.
  await recordStoredBytes(storageActor(req), album!, photo.size);

  sendSuccess(res, photo, 'Photo created successfully', 201);
};

/**
 * Get photos by album
 */
export const getPhotosByAlbum = async (req: Request, res: Response): Promise<void> => {
  const { albumId } = req.params;
  const { page, limit, search, tags, tagMatch } = req.query;

  const result = await photoService.getPhotosByAlbum(albumId as string, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : undefined,
    search: search as string,
    tags: parseTagsParam(tags),
    tagMatch: tagMatch === 'any' ? 'any' : 'all'
  });

  countRead(res, result.photos.length);
  sendSuccess(res, { photos: result.photos, pagination: result.pagination });
};

/**
 * Clamp a numeric query param into a sane range, ignoring anything unparseable.
 * The window and the per-year cap both size a query the caller does not pay
 * for, so neither is taken at face value.
 */
const parseBoundedNumber = (raw: unknown, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  if (raw === undefined || raw === null || raw === '' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

/**
 * Photos from this day in earlier years
 */
export const getMemories = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { groupId, windowDays, limitPerYear } = req.query;

  const memories = await memoriesService.getMemories(
    {
      groupId: groupId as string | undefined,
      windowDays: parseBoundedNumber(windowDays, 3, 0, 30),
      limitPerYear: parseBoundedNumber(limitPerYear, 12, 1, 50)
    },
    { userId: user.id, userGroups: req.userGroups || [] }
  );

  // Photos, not years: a year is a grouping, and what left the server is
  // the photos inside it.
  countRead(res, memories.totalPhotos);
  sendSuccess(res, memories);
};

/**
 * List the tags used by an album's photos, with usage counts
 */
export const getAlbumTags = async (req: Request, res: Response): Promise<void> => {
  const { albumId } = req.params;

  const tags = await photoService.getAlbumTags(albumId as string);

  sendSuccess(res, { tags });
};

/**
 * Add and/or remove tags across a set of photos
 */
export const bulkUpdateTags = async (req: Request, res: Response): Promise<void> => {
  const { photoIds, add, remove } = req.body;
  const user = req.user!;

  const result = await photoService.bulkUpdateTags(
    { photoIds, add, remove },
    { userId: user.id, userGroups: req.userGroups || [] }
  );

  sendSuccess(res, result, 'Tags updated successfully');
};

/**
 * Get photo by ID
 */
export const getPhotoById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = req.user!;

  const photo = await photoService.getPhotoById(id as string, {
    userId: user.id,
    userGroups: req.userGroups || []
  });

  sendSuccess(res, photo);
};

/**
 * Update photo metadata
 */
export const updatePhoto = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, tags, metadata } = req.body;
  const user = req.user!;

  const photo = await photoService.updatePhoto(
    id as string,
    { title, description, tags, metadata },
    { userId: user.id, userGroups: req.userGroups || [] }
  );

  sendSuccess(res, photo, 'Photo updated successfully');
};

/**
 * Delete photo
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;

  const deleted = await photoService.deletePhoto(id as string, {
    userId: user.id,
    userGroups: req.userGroups || []
  });

  // Hand the bytes back. A cumulative meter that only counts up locks people
  // out of storage they freed months earlier.
  const album = await Album.findById(deleted.albumId);
  if (album) await releaseStoredBytes(storageActor(req), album, deleted.size);

  sendSuccess(res, undefined, 'Photo deleted successfully');
};

/**
 * Get upload signed URL for direct client upload
 */
export const getUploadSignedUrlRequest = async (req: Request, res: Response): Promise<void> => {
  const { filename, mimetype, albumId, sizeBytes } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new UnauthorizedError('Access token required');
  }

  // Check if album exists
  const album = await Album.findById(albumId);
  if (!album) {
    throw new NotFoundError('Album not found');
  }

  // The storage chokepoint. This is the only point where the size is known
  // before the bytes are written; gating `createPhoto` instead would refuse the
  // record for an object already sitting in MinIO. Throws 402 when it does not
  // fit, and bills a group album to the group's owner (pooled storage).
  await assertStorageHeadroom(storageActor(req), album, sizeBytes);

  // Generate secure file ID (user-scoped for organization)
  const fileId = generateFileId(userId, albumId, filename, album.groupId);

  // Get upload URL directly from file service
  const uploadUrl = await getUploadSignedUrl(fileId, mimetype, 15);

  sendSuccess(res, { uploadUrl, minioFileId: fileId, albumId, expiresInMinutes: 15 });
};

/**
 * Get photo by minioFileId (for file service integration)
 */
export const getPhotoByFileId = async (req: Request, res: Response): Promise<void> => {
  const { fileId } = req.params;

  const photo = await photoService.getPhotoByFileId(fileId as string);

  sendSuccess(res, photo);
};
