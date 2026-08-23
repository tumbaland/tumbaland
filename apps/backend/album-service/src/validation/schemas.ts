import { z } from 'zod';

export const createAlbumSchema = z.object({
  name: z.string().trim().min(1, 'Album name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().optional()
});

export const updateAlbumSchema = z.object({
  name: z.string().trim().min(1, 'Album name cannot be empty').optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  coverPhotoId: z.string().optional(),
  groupId: z.string().optional()
});

export const setCoverPhotoSchema = z.object({
  photoId: z.string().min(1, 'Photo ID is required')
});

export const createPhotoSchema = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  fileId: z.string().optional(),
  minioFileId: z.string().optional(),
  albumId: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  mimetype: z.string().min(1),
  size: z.number().positive(),
  width: z.number().optional(),
  height: z.number().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).refine((data) => data.minioFileId || data.fileId, {
  message: 'minioFileId (or fileId) is required'
});

export const updatePhotoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const bulkUpdateTagsSchema = z.object({
  photoIds: z.array(z.string()).min(1, 'photoIds must contain at least one photo'),
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional()
}).refine((data) => (data.add?.length || 0) > 0 || (data.remove?.length || 0) > 0, {
  message: 'Must provide tags to add or remove'
});

export const uploadSignedUrlSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  albumId: z.string().min(1, 'albumId is required'),
  // The storage quota gate (MONETIZATION.md Phase 3, chokepoint 1) sits on this
  // request because it is the last moment a file's size is known before its
  // bytes are written. Required rather than optional: an omitted size would be
  // a free pass, and a client that does not send it is one that has not been
  // updated, not one that should upload unmetered.
  sizeBytes: z.number().int().positive('sizeBytes is required')
});

export const updatePhotoAIAnalysisSchema = z.object({
  objectDetection: z.record(z.string(), z.unknown()).optional(),
  segmentation: z.record(z.string(), z.unknown()).optional()
}).refine((data) => data.objectDetection || data.segmentation, {
  message: 'Must provide objectDetection or segmentation data'
});

export const createCollageSchema = z.object({
  title: z.string().min(1, 'title is required'),
  config: z.record(z.string(), z.unknown()),
  albumIds: z.array(z.string()).min(1, 'albumIds must contain at least one album'),
  groupId: z.string().optional()
});

export const updateCollageSchema = z.object({
  title: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  albumIds: z.array(z.string()).optional(),
  groupId: z.string().optional()
});
