import { z } from 'zod';

export const generateUploadUrlSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  mimetype: z.string().optional(),
  expiresInMinutes: z.number().optional()
});

export const generateDownloadUrlSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  expiresInMinutes: z.number().optional()
});

export const generateDownloadUrlsSchema = z.object({
  fileIds: z
    .array(z.string().min(1))
    .min(1, 'fileIds must contain at least one id')
    .max(1000, 'at most 1000 fileIds per request'),
  expiresInMinutes: z.number().optional()
});

export const deleteFolderSchema = z.object({
  prefix: z.string().min(1, 'prefix is required')
});
