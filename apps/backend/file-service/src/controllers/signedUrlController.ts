import { Request, Response } from 'express';
import { BadRequestError } from '@tumbaland/core';
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

  if (!fileId) {
    throw new BadRequestError('fileId is required');
  }

  const expiresMs = Date.now() + expiresInMinutes * 60 * 1000;
  const token = signToken('upload', fileId, expiresMs);
  const uploadUrl = `${FILE_SERVICE_PUBLIC_URL()}/files/upload/${fileId}?token=${token}&expires=${expiresMs}`;

  res.json({
    success: true,
    data: {
      uploadUrl,
      fileId,
      expiresMs,
      expiresInMinutes
    }
  });
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

  if (!fileId) {
    throw new BadRequestError('fileId is required');
  }

  const expiresMs = Date.now() + expiresInMinutes * 60 * 1000;
  const token = signToken('download', fileId, expiresMs);
  const downloadUrl = `${FILE_SERVICE_PUBLIC_URL()}/files/download/${fileId}?token=${token}&expires=${expiresMs}`;

  res.json({
    success: true,
    data: {
      downloadUrl,
      fileId,
      expiresMs,
      expiresInMinutes
    }
  });
};
