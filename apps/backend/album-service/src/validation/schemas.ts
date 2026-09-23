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

/**
 * Photo metadata as the browser extracts it from the file's EXIF.
 *
 * Client-supplied, so it is bounded rather than trusted: `z.record(z.unknown())`
 * would let a caller push an arbitrarily large blob straight into the document.
 * The shape mirrors apps/frontend/album-front/src/utils/exif.ts, and `exif`
 * stays open-ended on purpose — it is the drawer for tags no feature reads yet,
 * so adding one must not need a schema change on both sides.
 */
const exifExtraSchema = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
  .refine((value) => Object.keys(value).length <= 40, {
    message: 'exif may carry at most 40 entries'
  });

export const photoMetadataSchema = z.object({
  dateTaken: z.coerce.date().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      address: z.string().max(300).optional()
    })
    .optional(),
  camera: z
    .object({
      make: z.string().max(200).optional(),
      model: z.string().max(200).optional(),
      settings: z
        .object({
          iso: z.number().optional(),
          aperture: z.string().max(40).optional(),
          shutterSpeed: z.string().max(40).optional(),
          focalLength: z.string().max(40).optional()
        })
        .optional()
    })
    .optional(),
  exif: exifExtraSchema.optional()
});

export const createPhotoSchema = z
  .object({
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
    metadata: photoMetadataSchema.optional()
  })
  .refine((data) => data.minioFileId || data.fileId, {
    message: 'minioFileId (or fileId) is required'
  });

export const updatePhotoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: photoMetadataSchema.optional()
});

export const bulkUpdateTagsSchema = z
  .object({
    photoIds: z.array(z.string()).min(1, 'photoIds must contain at least one photo'),
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional()
  })
  .refine((data) => (data.add?.length || 0) > 0 || (data.remove?.length || 0) > 0, {
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
  sizeBytes: z
    .number()
    .int()
    .positive('sizeBytes is required')
    // file-service refuses anything larger (Cloudflare caps a request at
    // 100 MB). Said here, before the upload starts, rather than as a failed
    // upload.
    .max(95 * 1024 * 1024, 'That file is too large. The limit is 95 MB.')
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
