import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { signToken } from '../utils/hmac';

const FILE_SERVICE_PUBLIC_URL = (): string =>
  (process.env.FILE_SERVICE_PUBLIC_URL || 'http://localhost:4010').replace(/\/$/, '');

const DEFAULT_UPLOAD_MINUTES = 15;
const DEFAULT_DOWNLOAD_MINUTES = 60;

/** Longest bucket a download expiry is snapped to (see `bucketedExpiry`). */
const MAX_EXPIRY_BUCKET_MS = 15 * 60 * 1000;

/**
 * Expiry timestamp for a download URL, snapped to a fixed grid.
 *
 * The expiry is part of the signed URL, so a raw `Date.now() + ttl` makes the
 * URL for a given file different on every single request — and a browser
 * caches by URL. Viewing a 300-photo album re-listed the photos (grid query +
 * the unpaginated query behind the viewer, and again after any mutation),
 * each list minted fresh URLs, and the browser re-downloaded every image
 * instead of reusing the copy it already had. That is what tripped the rate
 * limiter.
 *
 * Snapping "now" down to the start of the current bucket makes repeated
 * requests for the same file produce a byte-identical URL for the length of
 * that bucket, so the `Cache-Control: private, max-age=3600` on the download
 * response can actually do its job. The cost is that a token's remaining life
 * is somewhere between `ttl - bucket` and `ttl` rather than exactly `ttl`;
 * the bucket is a quarter of the TTL (capped at 15 minutes) so a URL always
 * has at least three quarters of its nominal life left when handed out.
 */
const bucketedExpiry = (expiresInMinutes: number): number => {
  const ttlMs = expiresInMinutes * 60 * 1000;
  const bucketMs = Math.max(60 * 1000, Math.min(Math.floor(ttlMs / 4), MAX_EXPIRY_BUCKET_MS));
  return Math.floor(Date.now() / bucketMs) * bucketMs + ttlMs;
};

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

  const expiresMs = bucketedExpiry(expiresInMinutes);
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

  const expiresMs = bucketedExpiry(expiresInMinutes);
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
