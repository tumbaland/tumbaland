/**
 * fileServiceClient.ts
 *
 * Replaces the previous MinIO-based implementation.
 * All exported symbols have identical signatures - no changes needed in callers.
 *
 * Communicates with file-service over HTTP:
 *  - Internal API-key endpoints  → server-to-server operations (upload buffer, download, delete)
 *  - Signed URL generation       → browser-direct upload / download
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { logger } from '@tumbaland/core';

// ─── Config helpers ───────────────────────────────────────────────────────────

const fileServiceBaseUrl = (): string =>
  (process.env.FILE_SERVICE_URL || 'http://localhost:4010').replace(/\/$/, '');

const apiKey = (): string => {
  const key = process.env.FILE_SERVICE_API_KEY;
  if (!key) throw new Error('FILE_SERVICE_API_KEY env var is required');
  return key;
};

// ─── Low-level HTTP helpers ───────────────────────────────────────────────────

interface RawResponse {
  status: number;
  body: Buffer;
}

function request(
  method: string,
  urlStr: string,
  headers: Record<string, string> = {},
  body?: Buffer
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: http.RequestOptions = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? '443' : '80'),
      path: parsed.pathname + parsed.search,
      headers: {
        'X-Internal-Api-Key': apiKey(),
        ...headers,
        ...(body ? { 'Content-Length': String(body.length) } : {})
      }
    };

    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) })
      );
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestJson<T = unknown>(
  method: string,
  urlStr: string,
  payload?: unknown
): Promise<T> {
  const body = payload ? Buffer.from(JSON.stringify(payload)) : undefined;
  const headers: Record<string, string> = body
    ? { 'Content-Type': 'application/json' }
    : {};
  const { status, body: responseBody } = await request(method, urlStr, headers, body);
  const text = responseBody.toString('utf8');
  if (status < 200 || status >= 300) {
    throw new Error(`file-service ${method} ${urlStr} → ${status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

// ─── Re-exported pure helpers ────────────────────────────────────────────────────

export interface SignedUrlData {
  signedUrl: string;
  expiresAt: string;
  expiresInMinutes: number;
}

export interface FileUploadResult {
  fileId: string;
  bucket: string;
  key: string;
  size: number;
  etag: string;
}

export const generateFileId = (
  userId: string,
  albumId: string,
  originalFilename: string,
  groupId?: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalFilename.split('.').pop();
  const topLevelId = groupId || userId;
  const fileId = `${timestamp}-${random}`;
  return `${topLevelId}/${albumId}/${fileId}/original.${extension}`;
};

export const generateThumbnailFileId = (
  userId: string,
  albumId: string,
  originalFilename: string,
  groupId?: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const topLevelId = groupId || userId;
  const fileId = `${timestamp}-${random}`;
  return `${topLevelId}/${albumId}/${fileId}/thumbnail.jpg`;
};

export const generateThumbnailFileIdFromFileId = (fileId: string): string => {
  const parts = fileId.split('/');
  if (parts.length >= 4) {
    parts[parts.length - 1] = 'thumbnail.jpg';
    return parts.join('/');
  }
  return fileId.replace(/\/original\.[^.]+$/, '/thumbnail.jpg');
};

export const getFileFolder = (fileId: string): string => {
  const parts = fileId.split('/');
  if (parts.length >= 4) {
    return parts.slice(0, -1).join('/') + '/';
  }
  return fileId;
};

// ─── Signed URL generation (server → file-service → token → browser) ─────────

/**
 * Get a signed upload URL. The browser PUTs directly to this URL.
 */
export const getUploadSignedUrl = async (
  fileId: string,
  _mimetype: string,
  expiresInMinutes = 15
): Promise<string> => {
  const url = `${fileServiceBaseUrl()}/internal/upload-url`;
  const data = await requestJson<{ success: boolean; data: { uploadUrl: string } }>(
    'POST',
    url,
    { fileId, expiresInMinutes }
  );
  return data.data.uploadUrl;
};

/**
 * Get a signed download URL for a single fileId.
 */
export const getSignedUrl = async (
  fileId: string,
  expiresInMinutes = 60
): Promise<SignedUrlData | null> => {
  try {
    const url = `${fileServiceBaseUrl()}/internal/download-url`;
    const data = await requestJson<{
      success: boolean;
      data: { downloadUrl: string; expiresMs: number; expiresInMinutes: number };
    }>('POST', url, { fileId, expiresInMinutes });

    return {
      signedUrl: data.data.downloadUrl,
      expiresAt: new Date(data.data.expiresMs).toISOString(),
      expiresInMinutes: data.data.expiresInMinutes
    };
  } catch (error) {
    logger.error(`Failed to generate signed URL for ${fileId}:`, error);
    return null;
  }
};

/**
 * Get signed URL for a photo object (original or thumbnail).
 */
export const getPhotoSignedUrl = async (
  photo: { minioFileId?: string; minioThumbnailFileId?: string },
  isThumbnail = false,
  expiresInMinutes = 60
): Promise<SignedUrlData | null> => {
  const fileIdToUse = isThumbnail ? photo.minioThumbnailFileId : photo.minioFileId;
  if (!fileIdToUse) return null;
  return getSignedUrl(fileIdToUse, expiresInMinutes);
};

/**
 * Batch signed URL generation with concurrency limit.
 */
export const getPhotoSignedUrlsBatch = async (
  photos: Array<{ minioFileId?: string; minioThumbnailFileId?: string }>,
  isThumbnail = false,
  expiresInMinutes = 60
): Promise<Record<string, SignedUrlData>> => {
  const result: Record<string, SignedUrlData> = {};
  const concurrencyLimit = 10;

  for (let i = 0; i < photos.length; i += concurrencyLimit) {
    const batch = photos.slice(i, i + concurrencyLimit);
    await Promise.all(
      batch.map(async (photo) => {
        try {
          const signedUrlData = await getPhotoSignedUrl(photo, isThumbnail, expiresInMinutes);
          if (signedUrlData && photo.minioFileId) {
            result[photo.minioFileId] = signedUrlData;
          }
        } catch (error) {
          logger.warn(`Failed to get signed URL for photo ${photo.minioFileId}:`, error);
        }
      })
    );
  }

  return result;
};

// ─── Internal file operations (server-to-server) ──────────────────────────────

/**
 * Upload a file buffer to file-service (used by thumbnail generation).
 */
export const uploadFile = async (
  fileBuffer: Buffer,
  fileId: string,
  mimetype: string,
  size: number
): Promise<FileUploadResult> => {
  const url = `${fileServiceBaseUrl()}/internal/files/${fileId}`;
  const { status } = await request(
    'PUT',
    url,
    { 'Content-Type': mimetype, 'Content-Length': String(size) },
    fileBuffer
  );

  if (status < 200 || status >= 300) {
    throw new Error(`file-service upload failed with status ${status}`);
  }

  logger.info(`File uploaded via file-service: ${fileId}`, { size });

  return {
    fileId,
    bucket: 'file-service',
    key: fileId,
    size,
    etag: ''
  };
};

/**
 * Download a file from file-service as a Buffer.
 */
export const getFile = async (fileId: string): Promise<Buffer> => {
  const url = `${fileServiceBaseUrl()}/internal/files/${fileId}`;
  const { status, body } = await request('GET', url);

  if (status === 404) throw new Error(`File not found: ${fileId}`);
  if (status < 200 || status >= 300) {
    throw new Error(`file-service download failed with status ${status}`);
  }

  return body;
};

/**
 * Delete a single file.
 */
export const deleteFile = async (fileId: string): Promise<boolean> => {
  try {
    const url = `${fileServiceBaseUrl()}/internal/files/${fileId}`;
    const { status } = await request('DELETE', url);
    return status >= 200 && status < 300;
  } catch (error) {
    logger.error(`Failed to delete file ${fileId}:`, error);
    return false;
  }
};

/**
 * Delete all files under a folder prefix.
 */
export const deleteFolder = async (folderPrefix: string): Promise<boolean> => {
  try {
    const url = `${fileServiceBaseUrl()}/internal/files/folder`;
    await requestJson('DELETE', url, { prefix: folderPrefix });
    return true;
  } catch (error) {
    logger.error(`Failed to delete folder ${folderPrefix}:`, error);
    return false;
  }
};

/**
 * Check if a file exists.
 */
export const fileExists = async (fileId: string): Promise<boolean> => {
  try {
    const url = `${fileServiceBaseUrl()}/internal/files/${fileId}`;
    const { status } = await request('HEAD', url);
    return status === 200;
  } catch {
    return false;
  }
};

/**
 * Get file metadata.
 */
export const getFileMetadata = async (fileId: string): Promise<{ size: number; lastModified: Date }> => {
  const url = `${fileServiceBaseUrl()}/internal/meta/${fileId}`;
  const data = await requestJson<{ success: boolean; data: { size: number; lastModified: string } }>('GET', url);
  return { size: data.data.size, lastModified: new Date(data.data.lastModified) };
};

/**
 * List files with an optional prefix.
 */
export const listFiles = async (
  prefix?: string,
  maxKeys = 1000
): Promise<Array<{ name: string; size: number }>> => {
  const params = new URLSearchParams();
  if (prefix) params.set('prefix', prefix);
  params.set('maxKeys', String(maxKeys));
  const url = `${fileServiceBaseUrl()}/internal/files?${params.toString()}`;
  const data = await requestJson<{ success: boolean; data: Array<{ name: string; size: number }> }>('GET', url);
  return data.data;
};

/**
 * Copy a file (reads then writes under a new key).
 */
export const copyFile = async (sourceKey: string, destinationKey: string): Promise<void> => {
  const buffer = await getFile(sourceKey);
  await uploadFile(buffer, destinationKey, 'application/octet-stream', buffer.length);
  logger.info(`File copied: ${sourceKey} → ${destinationKey}`);
};
