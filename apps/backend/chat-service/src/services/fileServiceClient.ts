import { logger } from '@tumbaland/backend-core';

/**
 * The parts of file-service chat needs: mint a signed upload URL, mint download
 * URLs in bulk, store a generated thumbnail, and delete a message's folder.
 *
 * Not shared with album-service's client, which is a larger surface built on
 * the `http`/`https` modules from before Node had a global `fetch`. The right
 * home for one shared client is `@tumbaland/backend-core`, but a Docker build
 * installs that package from the registry (see TODO.md section 1.6), so a key
 * added to its source does not reach production until it is released. Lifting
 * this there is worth doing in the same batch as the next backend-core release.
 */

const baseUrl = (): string => (process.env.FILE_SERVICE_URL || 'http://localhost:5002').replace(/\/$/, '');

const apiKey = (): string => {
  const key = process.env.FILE_SERVICE_API_KEY;
  if (!key) throw new Error('FILE_SERVICE_API_KEY env var is required');
  return key;
};

/** Abort a file-service call that gets no response, so callers degrade instead of hanging. */
const TIMEOUT_MS = 10_000;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'X-Internal-Api-Key': apiKey(),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`file-service ${method} ${path} -> ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * A signed PUT URL the browser uploads to directly, never through this service.
 *
 * `maxBytes` is signed into the URL and file-service refuses a bigger body, so
 * the size the storage quota was checked against is an upper bound on what
 * lands.
 */
export async function getUploadUrl(
  fileId: string,
  mimetype: string,
  expiresInMinutes = 15,
  maxBytes?: number
): Promise<string> {
  const json = await call<{ data: { uploadUrl: string } }>('POST', '/internal/upload-url', {
    fileId,
    mimetype,
    expiresInMinutes,
    ...(maxBytes === undefined ? {} : { maxBytes })
  });
  return json.data.uploadUrl;
}

/**
 * How many bytes a stored file really takes, or null when there is no such
 * file (an upload that never finished).
 */
export async function storedSize(fileId: string): Promise<number | null> {
  const response = await fetch(`${baseUrl()}/internal/meta/${fileId}`, {
    headers: { 'X-Internal-Api-Key': apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`file-service GET /internal/meta -> ${response.status}`);
  const json = (await response.json()) as { data: { size: number } };
  return json.data.size;
}

/**
 * Download URLs for many files in one call.
 *
 * One request per page of messages rather than one per attachment: signing is
 * pure HMAC, and file-service snaps the expiry to a bucket so the same file
 * yields a byte-identical URL for a while. That is what lets the browser's own
 * cache work — a fresh URL per request re-downloads every image on every
 * render, which is what tripped album-service's rate limiter.
 */
export async function getDownloadUrls(
  fileIds: string[],
  expiresInMinutes = 60
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (fileIds.length === 0) return urls;

  try {
    const json = await call<{ data: { urls: Record<string, { downloadUrl: string }> } }>(
      'POST',
      '/internal/download-urls',
      { fileIds: [...new Set(fileIds)], expiresInMinutes }
    );
    for (const [fileId, value] of Object.entries(json.data.urls)) {
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
export async function uploadBuffer(fileId: string, buffer: Buffer, mimetype: string): Promise<void> {
  const response = await fetch(`${baseUrl()}/internal/files/${fileId}`, {
    method: 'PUT',
    headers: { 'X-Internal-Api-Key': apiKey(), 'Content-Type': mimetype },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`file-service PUT /internal/files/${fileId} -> ${response.status}`);
  }
}

/** Reads a stored file back, for generating a thumbnail from an upload. */
export async function downloadBuffer(fileId: string): Promise<Buffer> {
  const response = await fetch(`${baseUrl()}/internal/files/${fileId}`, {
    headers: { 'X-Internal-Api-Key': apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`file-service GET /internal/files/${fileId} -> ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Deletes every file under a prefix.
 *
 * Used when a message is deleted: its attachments live in one folder per
 * message, so one call removes the original, the thumbnail and any poster
 * without this service having to know which of them were generated.
 */
export async function deleteFolder(prefix: string): Promise<void> {
  await call('DELETE', '/internal/files/folder', { prefix });
}
