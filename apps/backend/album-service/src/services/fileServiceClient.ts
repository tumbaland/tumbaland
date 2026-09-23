/**
 * Album's side of file-service: where an album's files live, and what a failed
 * call means here. The calls themselves are backend-core's `fileService`.
 *
 * Reads degrade rather than throw: an album that renders with a missing image
 * is better than one that fails to load. Deletes report success instead of
 * throwing, because a photo whose file is already gone should still delete.
 */

import crypto from 'crypto';
import { DownloadUrl, fileService, logger } from '@tumbaland/backend-core';

export interface SignedUrlData {
  signedUrl: string;
  expiresAt: string;
  expiresInMinutes: number;
}

const toSignedUrlData = (url: DownloadUrl): SignedUrlData => ({
  signedUrl: url.downloadUrl,
  expiresAt: new Date(url.expiresMs).toISOString(),
  expiresInMinutes: url.expiresInMinutes
});

/**
 * The folder every file uploaded into an album goes under. `createPhoto`
 * checks a file id against it, so a photo can only point at a file that was
 * uploaded for that album.
 */
export const albumFolder = (albumId: string, userId: string, groupId?: string): string =>
  `${groupId || userId}/${albumId}/`;

/**
 * Unguessable, since the id is all that stands between one album's photos and
 * another's: `Math.random` is not meant for that.
 */
const uniquePart = (): string => `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

export const generateFileId = (userId: string, albumId: string, originalFilename: string, groupId?: string): string => {
  const extension = originalFilename.split('.').pop();
  return `${albumFolder(albumId, userId, groupId)}${uniquePart()}/original.${extension}`;
};

export const generateThumbnailFileId = (
  userId: string,
  albumId: string,
  _originalFilename: string,
  groupId?: string
): string => `${albumFolder(albumId, userId, groupId)}${uniquePart()}/thumbnail.jpg`;

/**
 * A signed URL the browser PUTs the upload to directly.
 *
 * `maxBytes` is signed into the URL and file-service refuses a bigger body, so
 * the size the storage quota was checked against bounds what lands.
 */
export const getUploadSignedUrl = (
  fileId: string,
  mimetype: string,
  expiresInMinutes = 15,
  maxBytes?: number
): Promise<string> => fileService.getUploadUrl(fileId, { mimetype, expiresInMinutes, maxBytes });

/** Signed URL for a photo's original or thumbnail, or null if it has none or signing failed. */
export const getPhotoSignedUrl = async (
  photo: { minioFileId?: string; minioThumbnailFileId?: string },
  isThumbnail = false,
  expiresInMinutes = 60
): Promise<SignedUrlData | null> => {
  const fileId = isThumbnail ? photo.minioThumbnailFileId : photo.minioFileId;
  if (!fileId) return null;
  try {
    return toSignedUrlData(await fileService.getDownloadUrl(fileId, expiresInMinutes));
  } catch (error) {
    logger.error(`Failed to generate signed URL for ${fileId}:`, error);
    return null;
  }
};

/** Signed URLs for many files, keyed by fileId. Empty if file-service could not be reached. */
export const getSignedUrlsBatch = async (
  fileIds: string[],
  expiresInMinutes = 60
): Promise<Record<string, SignedUrlData>> => {
  const result: Record<string, SignedUrlData> = {};
  try {
    const urls = await fileService.getDownloadUrls(fileIds, expiresInMinutes);
    for (const [fileId, url] of Object.entries(urls)) result[fileId] = toSignedUrlData(url);
  } catch (error) {
    logger.error('Failed to get batch signed URLs:', error);
  }
  return result;
};

/**
 * Batch signed URLs for photo documents. The result is keyed by `minioFileId`
 * whichever of original or thumbnail was signed, which is what the album and
 * photo list builders look it up by.
 */
export const getPhotoSignedUrlsBatch = async (
  photos: Array<{ minioFileId?: string; minioThumbnailFileId?: string }>,
  isThumbnail = false,
  expiresInMinutes = 60
): Promise<Record<string, SignedUrlData>> => {
  const entries = photos
    .map((photo) => ({
      key: photo.minioFileId,
      fileId: isThumbnail ? photo.minioThumbnailFileId : photo.minioFileId
    }))
    .filter((e): e is { key: string; fileId: string } => Boolean(e.key && e.fileId));

  const urlMap = await getSignedUrlsBatch(
    entries.map((e) => e.fileId),
    expiresInMinutes
  );

  const result: Record<string, SignedUrlData> = {};
  for (const entry of entries) {
    const data = urlMap[entry.fileId];
    if (data) result[entry.key] = data;
  }
  return result;
};

/** Stores a buffer this service generated (a thumbnail). */
export const uploadFile = async (fileBuffer: Buffer, fileId: string, mimetype: string): Promise<void> => {
  await fileService.putFile(fileId, fileBuffer, mimetype);
  logger.info(`File uploaded via file-service: ${fileId}`, { size: fileBuffer.length });
};

export const getFile = (fileId: string): Promise<Buffer> => fileService.getFile(fileId);

/** Whether the file was deleted. Never throws. */
export const deleteFile = async (fileId: string): Promise<boolean> => {
  try {
    await fileService.deleteFile(fileId);
    return true;
  } catch (error) {
    logger.error(`Failed to delete file ${fileId}:`, error);
    return false;
  }
};

export const storedSize = (fileId: string): Promise<number | null> => fileService.storedSize(fileId);
