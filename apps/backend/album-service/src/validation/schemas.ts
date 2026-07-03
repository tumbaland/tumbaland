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
  metadata: z.record(z.string(), z.any()).optional()
}).refine((data) => data.minioFileId || data.fileId, {
  message: 'minioFileId (or fileId) is required'
});

export const updatePhotoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const uploadSignedUrlSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  mimetype: z.string().min(1, 'mimetype is required'),
  albumId: z.string().min(1, 'albumId is required')
});

export const updatePhotoAIAnalysisSchema = z.object({
  objectDetection: z.record(z.string(), z.any()).optional(),
  segmentation: z.record(z.string(), z.any()).optional()
}).refine((data) => data.objectDetection || data.segmentation, {
  message: 'Must provide objectDetection or segmentation data'
});

export const createCollageSchema = z.object({
  title: z.string().min(1, 'title is required'),
  config: z.record(z.string(), z.any()),
  albumIds: z.array(z.string()).min(1, 'albumIds must contain at least one album')
});

export const updateCollageSchema = z.object({
  title: z.string().min(1).optional(),
  config: z.record(z.string(), z.any()).optional(),
  albumIds: z.array(z.string()).optional()
});
