import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { signToken } from '../utils/hmac';

const FILE_SERVICE_PUBLIC_URL = (): string =>
  (process.env.FILE_SERVICE_PUBLIC_URL || 'http://localhost:4010').replace(/\/$/, '');

const DEFAULT_UPLOAD_MINUTES = 15;
const DEFAULT_DOWNLOAD_MINUTES = 60;

/**
 * POST /internal/upload-url
 * Body: { fileId, mimetype?, expiresInMinutes? }
 * Returns a signed PUT URL the browser can use to upload directly.
 */
export const generateUploadUrl = (req: Request, res: Response): void => {
  const { fileId, expiresInMinutes = DEFAULT_UPLOAD_MINUTES } = req.body as {
    fileId: string;
    mimetype?: string;
    expiresInMinutes?: number;
  };

  const expiresMs = Date.now() + expiresInMinutes * 60 * 1000;
  const token = signToken('upload', fileId, expiresMs);
  const uploadUrl = `${FILE_SERVICE_PUBLIC_URL()}/files/upload/${fileId}?token=${token}&expires=${expiresMs}`;

  sendSuccess(res, { uploadUrl, fileId, expiresMs, expiresInMinutes });
};

/**
 * POST /internal/download-url
 * Body: { fileId, expiresInMinutes? }
 * Returns a signed GET URL the browser can use to download/display directly.
 */
export const generateDownloadUrl = (req: Request, res: Response): void => {
  const { fileId, expiresInMinutes = DEFAULT_DOWNLOAD_MINUTES } = req.body as {
    fileId: string;
    expiresInMinutes?: number;
  };

  const expiresMs = Date.now() + expiresInMinutes * 60 * 1000;
  const token = signToken('download', fileId, expiresMs);
  const downloadUrl = `${FILE_SERVICE_PUBLIC_URL()}/files/download/${fileId}?token=${token}&expires=${expiresMs}`;

  sendSuccess(res, { downloadUrl, fileId, expiresMs, expiresInMinutes });
};

/**
 * POST /internal/download-urls
 * Body: { fileIds: string[], expiresInMinutes? }
 * Batch variant of /internal/download-url: signing is pure HMAC, so one
 * request can produce URLs for a whole collage/album (up to 1000 files)
 * instead of one round-trip per file.
 */
export const generateDownloadUrls = (req: Request, res: Response): void => {
  const { fileIds, expiresInMinutes = DEFAULT_DOWNLOAD_MINUTES } = req.body as {
    fileIds: string[];
    expiresInMinutes?: number;
  };

  const expiresMs = Date.now() + expiresInMinutes * 60 * 1000;
  const urls: Record<string, { downloadUrl: string; expiresMs: number; expiresInMinutes: number }> = {};
  for (const fileId of fileIds) {
    const token = signToken('download', fileId, expiresMs);
    urls[fileId] = {
      downloadUrl: `${FILE_SERVICE_PUBLIC_URL()}/files/download/${fileId}?token=${token}&expires=${expiresMs}`,
      expiresMs,
      expiresInMinutes
    };
  }

  sendSuccess(res, { urls, expiresMs, expiresInMinutes });
};
