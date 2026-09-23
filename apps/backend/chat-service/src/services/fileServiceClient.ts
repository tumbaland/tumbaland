import { fileService, logger } from '@tumbaland/backend-core';

/**
 * The parts of file-service chat needs, over backend-core's `fileService`:
 * mint a signed upload URL, mint download URLs in bulk, store a generated
 * thumbnail, and delete a message's folder.
 */

/**
 * A signed PUT URL the browser uploads to directly, never through this service.
 *
 * `maxBytes` is signed into the URL and file-service refuses a bigger body, so
 * the size the storage quota was checked against is an upper bound on what
 * lands.
 */
export const getUploadUrl = (
  fileId: string,
  mimetype: string,
  expiresInMinutes = 15,
  maxBytes?: number
): Promise<string> => fileService.getUploadUrl(fileId, { mimetype, expiresInMinutes, maxBytes });

/**
 * How many bytes a stored file really takes, or null when there is no such
 * file (an upload that never finished).
 */
export const storedSize = (fileId: string): Promise<number | null> => fileService.storedSize(fileId);

/**
 * Download URLs for many files in one call.
 *
 * One request per page of messages rather than one per attachment. file-service
 * snaps the expiry to a bucket so the same file yields a byte-identical URL for
 * a while, which is what lets the browser's own cache work.
 */
export async function getDownloadUrls(
  fileIds: string[],
  expiresInMinutes = 60
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (fileIds.length === 0) return urls;

  try {
    const signed = await fileService.getDownloadUrls(fileIds, expiresInMinutes);
    for (const [fileId, value] of Object.entries(signed)) {
      urls.set(fileId, value.downloadUrl);
    }
  } catch (error) {
    // A thread that renders without its images is better than one that fails
    // to load at all, so this degrades rather than throwing.
    logger.warn('Could not mint chat download URLs', { error: (error as Error).message });
  }
  return urls;
}

/** Stores a buffer this service generated, such as a thumbnail. */
export const uploadBuffer = (fileId: string, buffer: Buffer, mimetype: string): Promise<void> =>
  fileService.putFile(fileId, buffer, mimetype);

/** Reads a stored file back, for generating a thumbnail from an upload. */
export const downloadBuffer = (fileId: string): Promise<Buffer> => fileService.getFile(fileId);

/**
 * Deletes every file under a prefix.
 *
 * Used when a message is deleted: its attachments live in one folder per
 * message, so one call removes the original, the thumbnail and any poster
 * without this service having to know which of them were generated.
 */
export const deleteFolder = (prefix: string): Promise<void> => fileService.deleteFolder(prefix);
