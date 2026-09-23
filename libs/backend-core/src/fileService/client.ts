/**
 * Server-to-server calls to file-service's `/internal` API, authenticated with
 * `FILE_SERVICE_API_KEY`. Browsers never come through here: they get a signed
 * URL from this client and upload or download against file-service directly.
 *
 * This is the protocol only. What a failure means is the caller's decision (a
 * thread that renders without its images beats one that fails to load), so
 * every call throws a `FileServiceError` and leaves degrading to the caller.
 */

/** Abort a call that gets no response, so callers degrade instead of hanging. */
const REQUEST_TIMEOUT_MS = 10_000;

/** The most fileIds file-service signs in one `/internal/download-urls` request. */
const DOWNLOAD_URLS_PER_REQUEST = 1000;

export class FileServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'FileServiceError';
  }
}

export interface DownloadUrl {
  downloadUrl: string;
  /** When the URL stops working, in epoch milliseconds. */
  expiresMs: number;
  expiresInMinutes: number;
}

const baseUrl = (): string => (process.env.FILE_SERVICE_URL || 'http://localhost:5002').replace(/\/$/, '');

const apiKey = (): string => {
  const key = process.env.FILE_SERVICE_API_KEY;
  if (!key) throw new Error('FILE_SERVICE_API_KEY env var is required');
  return key;
};

async function send(
  method: string,
  path: string,
  body?: { json: unknown } | { bytes: Buffer; mimetype: string }
): Promise<Response> {
  const headers: Record<string, string> = { 'X-Internal-Api-Key': apiKey() };
  let payload: BodyInit | undefined;
  if (body && 'json' in body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body.json);
  } else if (body) {
    headers['Content-Type'] = body.mimetype;
    payload = new Uint8Array(body.bytes);
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new FileServiceError(response.status, `file-service ${method} ${path} -> ${response.status}`);
  }
  return response;
}

async function data<T>(method: string, path: string, json?: unknown): Promise<T> {
  const response = await send(method, path, json === undefined ? undefined : { json });
  return ((await response.json()) as { data: T }).data;
}

/**
 * A signed PUT URL the browser uploads to directly.
 *
 * `maxBytes` is signed into the URL and file-service refuses a bigger body, so
 * the size a storage quota was checked against is an upper bound on what lands.
 */
export async function getUploadUrl(
  fileId: string,
  options: { mimetype?: string; expiresInMinutes?: number; maxBytes?: number } = {}
): Promise<string> {
  const { mimetype, expiresInMinutes = 15, maxBytes } = options;
  const result = await data<{ uploadUrl: string }>('POST', '/internal/upload-url', {
    fileId,
    expiresInMinutes,
    ...(mimetype === undefined ? {} : { mimetype }),
    ...(maxBytes === undefined ? {} : { maxBytes })
  });
  return result.uploadUrl;
}

/** A signed GET URL for one file. */
export async function getDownloadUrl(fileId: string, expiresInMinutes = 60): Promise<DownloadUrl> {
  return data<DownloadUrl>('POST', '/internal/download-url', { fileId, expiresInMinutes });
}

/**
 * Signed GET URLs for many files, keyed by fileId, in one request per thousand.
 *
 * Signing is pure HMAC and file-service snaps the expiry to a bucket, so the
 * same file yields a byte-identical URL for a while. That is what lets the
 * browser's cache work; a per-file request for each one tripped the rate
 * limiter on a 100-photo collage.
 */
export async function getDownloadUrls(fileIds: string[], expiresInMinutes = 60): Promise<Record<string, DownloadUrl>> {
  const unique = [...new Set(fileIds.filter(Boolean))];
  const urls: Record<string, DownloadUrl> = {};
  for (let i = 0; i < unique.length; i += DOWNLOAD_URLS_PER_REQUEST) {
    const result = await data<{ urls: Record<string, DownloadUrl> }>('POST', '/internal/download-urls', {
      fileIds: unique.slice(i, i + DOWNLOAD_URLS_PER_REQUEST),
      expiresInMinutes
    });
    Object.assign(urls, result.urls);
  }
  return urls;
}

/** Stores bytes this service produced itself, such as a thumbnail. */
export async function putFile(fileId: string, bytes: Buffer, mimetype: string): Promise<void> {
  await send('PUT', `/internal/files/${fileId}`, { bytes, mimetype });
}

/** Reads a stored file back. A missing file is a `FileServiceError` with status 404. */
export async function getFile(fileId: string): Promise<Buffer> {
  const response = await send('GET', `/internal/files/${fileId}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteFile(fileId: string): Promise<void> {
  await send('DELETE', `/internal/files/${fileId}`);
}

/** Deletes every file whose id starts with `prefix`. */
export async function deleteFolder(prefix: string): Promise<void> {
  await send('DELETE', '/internal/files/folder', { json: { prefix } });
}

/**
 * How many bytes a stored file really takes, or null when there is no such
 * file (an upload that never finished).
 */
export async function storedSize(fileId: string): Promise<number | null> {
  try {
    return (await data<{ size: number }>('GET', `/internal/meta/${fileId}`)).size;
  } catch (error) {
    if (error instanceof FileServiceError && error.status === 404) return null;
    throw error;
  }
}
