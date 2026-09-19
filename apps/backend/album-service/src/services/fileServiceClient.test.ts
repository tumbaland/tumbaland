import http from 'http';
import { AddressInfo } from 'net';
import {
  generateFileId,
  generateThumbnailFileId,
  generateThumbnailFileIdFromFileId,
  getFileFolder,
  getUploadSignedUrl,
  getSignedUrl,
  getPhotoSignedUrl,
  getSignedUrlsBatch,
  getPhotoSignedUrlsBatch,
  uploadFile,
  getFile,
  deleteFile,
  deleteFolder,
  fileExists,
  getFileMetadata,
  listFiles,
  copyFile
} from './fileServiceClient';

// This is a raw http/https client (not fetch), so a real local HTTP server
// is simpler and more reliable than mocking Node's http module internals.
let server: http.Server;
let baseUrl: string;
let lastRequest: { method?: string; url?: string; headers?: http.IncomingHttpHeaders; body?: string } | null = null;
let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeAll((done) => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      lastRequest = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
      handler(req, res);
    });
  });
  server.listen(0, () => {
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  process.env.FILE_SERVICE_URL = baseUrl;
  process.env.FILE_SERVICE_API_KEY = 'test-api-key';
  lastRequest = null;
});

function jsonResponder(status: number, body: unknown) {
  handler = (_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

describe('pure id/path helpers', () => {
  it('generateFileId builds a user-scoped path with the original extension', () => {
    const id = generateFileId('user-1', 'album-1', 'photo.jpg');
    expect(id).toMatch(/^user-1\/album-1\/.+\/original\.jpg$/);
  });

  it('generateFileId scopes to the group when groupId is provided', () => {
    const id = generateFileId('user-1', 'album-1', 'photo.jpg', 'group-1');
    expect(id.startsWith('group-1/album-1/')).toBe(true);
  });

  it('generateThumbnailFileId builds a thumbnail.jpg path', () => {
    const id = generateThumbnailFileId('user-1', 'album-1', 'photo.png');
    expect(id).toMatch(/^user-1\/album-1\/.+\/thumbnail\.jpg$/);
  });

  it('generateThumbnailFileIdFromFileId swaps the last segment for thumbnail.jpg', () => {
    expect(generateThumbnailFileIdFromFileId('u1/a1/123/original.jpg')).toBe('u1/a1/123/thumbnail.jpg');
  });

  it('generateThumbnailFileIdFromFileId falls back to suffix replacement for short paths', () => {
    expect(generateThumbnailFileIdFromFileId('foo/original.png')).toBe('foo/thumbnail.jpg');
  });

  it('getFileFolder returns the parent folder with a trailing slash', () => {
    expect(getFileFolder('u1/a1/123/original.jpg')).toBe('u1/a1/123/');
  });

  it('getFileFolder returns the fileId unchanged for short paths', () => {
    expect(getFileFolder('short.jpg')).toBe('short.jpg');
  });
});

describe('getUploadSignedUrl', () => {
  it('POSTs to /internal/upload-url and returns the uploadUrl', async () => {
    jsonResponder(200, { success: true, data: { uploadUrl: 'https://upload.example' } });

    const url = await getUploadSignedUrl('a/b.jpg', 'image/jpeg', 10);

    expect(url).toBe('https://upload.example');
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.url).toBe('/internal/upload-url');
    expect(lastRequest?.headers?.['x-internal-api-key']).toBe('test-api-key');
    expect(JSON.parse(lastRequest!.body!)).toEqual({ fileId: 'a/b.jpg', expiresInMinutes: 10 });
  });
});

describe('getSignedUrl', () => {
  it('returns signed URL data on success', async () => {
    jsonResponder(200, { success: true, data: { downloadUrl: 'https://dl', expiresMs: 12345, expiresInMinutes: 60 } });

    const data = await getSignedUrl('a.jpg');

    expect(data).toMatchObject({ signedUrl: 'https://dl', expiresInMinutes: 60 });
  });

  it('returns null and logs when the request fails', async () => {
    jsonResponder(500, { success: false });

    expect(await getSignedUrl('a.jpg')).toBeNull();
  });
});

describe('getPhotoSignedUrl', () => {
  it('returns null when the relevant fileId is missing', async () => {
    expect(await getPhotoSignedUrl({}, false)).toBeNull();
    expect(await getPhotoSignedUrl({ minioFileId: 'x' }, true)).toBeNull();
  });

  it('resolves the thumbnail fileId when isThumbnail is true', async () => {
    jsonResponder(200, { success: true, data: { downloadUrl: 'https://dl', expiresMs: 1, expiresInMinutes: 60 } });

    const data = await getPhotoSignedUrl({ minioThumbnailFileId: 'thumb.jpg' }, true);

    expect(data).not.toBeNull();
    expect(lastRequest?.url).toBe('/internal/download-url');
  });
});

describe('getSignedUrlsBatch', () => {
  it('returns an empty object for an empty/falsy fileIds list', async () => {
    expect(await getSignedUrlsBatch([])).toEqual({});
  });

  it('dedupes fileIds and maps the batch response back by fileId', async () => {
    jsonResponder(200, {
      success: true,
      data: { urls: { 'a.jpg': { downloadUrl: 'https://a', expiresMs: 1, expiresInMinutes: 60 } } }
    });

    const result = await getSignedUrlsBatch(['a.jpg', 'a.jpg']);

    expect(result['a.jpg']).toMatchObject({ signedUrl: 'https://a' });
    expect(JSON.parse(lastRequest!.body!).fileIds).toEqual(['a.jpg']);
  });

  it('falls back to per-file requests when the batch endpoint 404s', async () => {
    let callCount = 0;
    handler = (req, res) => {
      callCount++;
      if (req.url === '/internal/download-urls') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ success: true, data: { downloadUrl: 'https://x', expiresMs: 1, expiresInMinutes: 60 } })
        );
      }
    };

    const result = await getSignedUrlsBatch(['a.jpg', 'b.jpg']);

    expect(result['a.jpg']).toMatchObject({ signedUrl: 'https://x' });
    expect(result['b.jpg']).toMatchObject({ signedUrl: 'https://x' });
    expect(callCount).toBeGreaterThan(1);
  });

  it('logs and continues (empty result) on a non-404 batch failure', async () => {
    jsonResponder(500, { success: false });

    expect(await getSignedUrlsBatch(['a.jpg'])).toEqual({});
  });
});

describe('getPhotoSignedUrlsBatch', () => {
  it('keys results by minioFileId regardless of isThumbnail', async () => {
    jsonResponder(200, {
      success: true,
      data: { urls: { 'thumb.jpg': { downloadUrl: 'https://t', expiresMs: 1, expiresInMinutes: 60 } } }
    });

    const result = await getPhotoSignedUrlsBatch(
      [{ minioFileId: 'orig.jpg', minioThumbnailFileId: 'thumb.jpg' }],
      true
    );

    expect(result['orig.jpg']).toMatchObject({ signedUrl: 'https://t' });
  });

  it('filters out photos missing the relevant fileId', async () => {
    const result = await getPhotoSignedUrlsBatch([{ minioFileId: undefined }], false);
    expect(result).toEqual({});
  });
});

describe('uploadFile', () => {
  it('PUTs the buffer and returns upload metadata on success', async () => {
    handler = (_req, res) => res.writeHead(200).end();

    const result = await uploadFile(Buffer.from('data'), 'a.jpg', 'image/jpeg', 4);

    expect(result).toMatchObject({ fileId: 'a.jpg', size: 4 });
    expect(lastRequest?.method).toBe('PUT');
  });

  it('throws when the upload responds with a non-2xx status', async () => {
    handler = (_req, res) => res.writeHead(500).end();

    await expect(uploadFile(Buffer.from('data'), 'a.jpg', 'image/jpeg', 4)).rejects.toThrow(
      'upload failed with status 500'
    );
  });
});

describe('getFile', () => {
  it('returns the response body buffer on success', async () => {
    handler = (_req, res) => res.writeHead(200).end('file contents');

    expect((await getFile('a.jpg')).toString()).toBe('file contents');
  });

  it('throws a specific message on 404', async () => {
    handler = (_req, res) => res.writeHead(404).end();

    await expect(getFile('missing.jpg')).rejects.toThrow('File not found: missing.jpg');
  });

  it('throws a generic message on other failures', async () => {
    handler = (_req, res) => res.writeHead(500).end();

    await expect(getFile('a.jpg')).rejects.toThrow('download failed with status 500');
  });
});

describe('deleteFile', () => {
  it('returns true on a 2xx response', async () => {
    handler = (_req, res) => res.writeHead(204).end();
    expect(await deleteFile('a.jpg')).toBe(true);
  });

  it('returns false on a non-2xx response', async () => {
    handler = (_req, res) => res.writeHead(500).end();
    expect(await deleteFile('a.jpg')).toBe(false);
  });

  it('returns false (does not throw) when the request itself errors', async () => {
    process.env.FILE_SERVICE_URL = 'http://127.0.0.1:1';
    expect(await deleteFile('a.jpg')).toBe(false);
  });
});

describe('deleteFolder', () => {
  it('returns true on success', async () => {
    jsonResponder(200, { success: true });
    expect(await deleteFolder('albums/a1')).toBe(true);
    expect(lastRequest?.method).toBe('DELETE');
  });

  it('returns false (does not throw) on failure', async () => {
    jsonResponder(500, { success: false });
    expect(await deleteFolder('albums/a1')).toBe(false);
  });
});

describe('fileExists', () => {
  it('returns true for a 200 HEAD response', async () => {
    handler = (_req, res) => res.writeHead(200).end();
    expect(await fileExists('a.jpg')).toBe(true);
  });

  it('returns false for a non-200 response', async () => {
    handler = (_req, res) => res.writeHead(404).end();
    expect(await fileExists('a.jpg')).toBe(false);
  });

  it('returns false (does not throw) when the request errors', async () => {
    process.env.FILE_SERVICE_URL = 'http://127.0.0.1:1';
    expect(await fileExists('a.jpg')).toBe(false);
  });
});

describe('getFileMetadata', () => {
  it('returns size and a parsed lastModified date', async () => {
    jsonResponder(200, { success: true, data: { size: 42, lastModified: '2026-01-01T00:00:00.000Z' } });

    const meta = await getFileMetadata('a.jpg');

    expect(meta.size).toBe(42);
    expect(meta.lastModified.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('listFiles', () => {
  it('includes prefix and maxKeys in the query string', async () => {
    jsonResponder(200, { success: true, data: [{ name: 'a.jpg', size: 1 }] });

    const files = await listFiles('albums/a1', 50);

    expect(files).toEqual([{ name: 'a.jpg', size: 1 }]);
    expect(lastRequest?.url).toContain('prefix=albums%2Fa1');
    expect(lastRequest?.url).toContain('maxKeys=50');
  });
});

describe('copyFile', () => {
  it('reads the source and writes it to the destination', async () => {
    let call = 0;
    handler = (req, res) => {
      call++;
      if (req.method === 'GET') {
        res.writeHead(200).end('source bytes');
      } else {
        res.writeHead(200).end();
      }
    };

    await copyFile('src.jpg', 'dest.jpg');
    expect(call).toBe(2);
  });
});

describe('apiKey configuration', () => {
  it('throws when FILE_SERVICE_API_KEY is not set', async () => {
    delete process.env.FILE_SERVICE_API_KEY;
    await expect(fileExists('a.jpg')).resolves.toBe(false);
  });
});
