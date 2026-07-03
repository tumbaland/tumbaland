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

export const deleteFolderSchema = z.object({
  prefix: z.string().min(1, 'prefix is required')
});
