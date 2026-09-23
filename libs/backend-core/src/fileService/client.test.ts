import {
  FileServiceError,
  deleteFile,
  deleteFolder,
  getDownloadUrl,
  getDownloadUrls,
  getFile,
  getUploadUrl,
  putFile,
  storedSize
} from './client';

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;
const fetchMock = jest.fn();

const ok = (body: unknown = {}) => ({
  ok: true,
  status: 200,
  json: async () => body,
  arrayBuffer: async () => new TextEncoder().encode('bytes').buffer
});
const refused = (status: number) => ({ ok: false, status });

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    FILE_SERVICE_URL: 'http://file-service:5002',
    FILE_SERVICE_API_KEY: 'test-key'
  };
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok({ data: {} }));
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  global.fetch = ORIGINAL_FETCH;
});

const lastCall = () => fetchMock.mock.calls.at(-1)!;
const lastBody = () => JSON.parse(lastCall()[1].body);

describe('every call', () => {
  it('sends the internal API key', async () => {
    await deleteFile('f');

    expect(lastCall()[1].headers['X-Internal-Api-Key']).toBe('test-key');
  });

  it('refuses to run without a key rather than calling unauthenticated', async () => {
    delete process.env.FILE_SERVICE_API_KEY;

    await expect(deleteFile('f')).rejects.toThrow(/FILE_SERVICE_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('strips a trailing slash from the base URL, so paths never double up', async () => {
    process.env.FILE_SERVICE_URL = 'http://file-service:5002/';

    await deleteFile('f');

    expect(lastCall()[0]).toBe('http://file-service:5002/internal/files/f');
  });

  it('defaults to file-service on its own port', async () => {
    delete process.env.FILE_SERVICE_URL;

    await deleteFile('f');

    expect(lastCall()[0]).toBe('http://localhost:5002/internal/files/f');
  });

  it('gives up on a call that gets no response', async () => {
    await deleteFile('f');

    expect(lastCall()[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('throws a FileServiceError carrying the status on a refusal', async () => {
    fetchMock.mockResolvedValue(refused(403));

    const error = await deleteFile('f').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FileServiceError);
    expect(error).toMatchObject({ status: 403, message: 'file-service DELETE /internal/files/f -> 403' });
  });
});

describe('getUploadUrl', () => {
  it('asks for a signed URL and returns it', async () => {
    fetchMock.mockResolvedValue(ok({ data: { uploadUrl: 'https://files/upload?token=x' } }));

    const url = await getUploadUrl('a/b.jpg', { mimetype: 'image/jpeg', expiresInMinutes: 10, maxBytes: 500 });

    expect(url).toBe('https://files/upload?token=x');
    expect(lastCall()[0]).toBe('http://file-service:5002/internal/upload-url');
    expect(lastCall()[1].method).toBe('POST');
    expect(lastBody()).toEqual({ fileId: 'a/b.jpg', mimetype: 'image/jpeg', expiresInMinutes: 10, maxBytes: 500 });
  });

  it('leaves out what the caller did not set, and expires in 15 minutes by default', async () => {
    fetchMock.mockResolvedValue(ok({ data: { uploadUrl: 'u' } }));

    await getUploadUrl('a/b.jpg');

    expect(lastBody()).toEqual({ fileId: 'a/b.jpg', expiresInMinutes: 15 });
  });
});

describe('getDownloadUrl', () => {
  it('returns the signed URL with its expiry', async () => {
    const signed = { downloadUrl: 'https://dl', expiresMs: 12345, expiresInMinutes: 60 };
    fetchMock.mockResolvedValue(ok({ data: signed }));

    expect(await getDownloadUrl('a.jpg')).toEqual(signed);
    expect(lastCall()[0]).toBe('http://file-service:5002/internal/download-url');
    expect(lastBody()).toEqual({ fileId: 'a.jpg', expiresInMinutes: 60 });
  });
});

describe('getDownloadUrls', () => {
  const signed = (url: string) => ({ downloadUrl: url, expiresMs: 1, expiresInMinutes: 60 });

  it('asks for every id in one call and keys the answer by fileId', async () => {
    fetchMock.mockResolvedValue(ok({ data: { urls: { f1: signed('u1'), f2: signed('u2') } } }));

    const urls = await getDownloadUrls(['f1', 'f2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls).toEqual({ f1: signed('u1'), f2: signed('u2') });
  });

  it('drops duplicates and empty ids before asking', async () => {
    fetchMock.mockResolvedValue(ok({ data: { urls: {} } }));

    await getDownloadUrls(['f1', 'f1', '', 'f2']);

    expect(lastBody().fileIds).toEqual(['f1', 'f2']);
  });

  it('calls nothing for an empty list', async () => {
    expect(await getDownloadUrls([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('splits more ids than file-service signs at once across requests', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ data: { urls: { f0: signed('u0') } } }))
      .mockResolvedValueOnce(ok({ data: { urls: { f1000: signed('u1000') } } }));
    const ids = Array.from({ length: 1001 }, (_, i) => `f${i}`);

    const urls = await getDownloadUrls(ids);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).fileIds).toHaveLength(1000);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).fileIds).toEqual(['f1000']);
    expect(urls).toEqual({ f0: signed('u0'), f1000: signed('u1000') });
  });

  it('throws on a refusal and leaves degrading to the caller', async () => {
    fetchMock.mockResolvedValue(refused(500));

    await expect(getDownloadUrls(['f1'])).rejects.toThrow(FileServiceError);
  });
});

describe('putFile', () => {
  it('PUTs the bytes with their own content type', async () => {
    await putFile('chat/g1/c1/a/thumb.webp', Buffer.from('x'), 'image/webp');

    const [url, init] = lastCall();
    expect(url).toBe('http://file-service:5002/internal/files/chat/g1/c1/a/thumb.webp');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('image/webp');
    expect(Buffer.from(init.body).toString()).toBe('x');
  });
});

describe('getFile', () => {
  it('returns the file as a Buffer', async () => {
    expect((await getFile('f')).toString()).toBe('bytes');
  });

  it('throws a 404 FileServiceError when the file is missing', async () => {
    fetchMock.mockResolvedValue(refused(404));

    await expect(getFile('f')).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteFile', () => {
  it('DELETEs the one file', async () => {
    await deleteFile('u1/a1/123/original.jpg');

    expect(lastCall()[0]).toBe('http://file-service:5002/internal/files/u1/a1/123/original.jpg');
    expect(lastCall()[1].method).toBe('DELETE');
  });
});

describe('deleteFolder', () => {
  it('removes everything under one prefix', async () => {
    await deleteFolder('chat/g1/c1/abc');

    const [url, init] = lastCall();
    expect(url).toBe('http://file-service:5002/internal/files/folder');
    expect(init.method).toBe('DELETE');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ prefix: 'chat/g1/c1/abc' });
  });
});

describe('storedSize', () => {
  it('returns the stored byte count', async () => {
    fetchMock.mockResolvedValue(ok({ data: { size: 42, lastModified: '2026-01-01T00:00:00.000Z' } }));

    expect(await storedSize('f')).toBe(42);
    expect(lastCall()[0]).toBe('http://file-service:5002/internal/meta/f');
  });

  it('is null for a file that was never stored', async () => {
    fetchMock.mockResolvedValue(refused(404));

    expect(await storedSize('f')).toBeNull();
  });

  it('throws on any other failure, so an outage is not read as "no file"', async () => {
    fetchMock.mockResolvedValue(refused(500));

    await expect(storedSize('f')).rejects.toMatchObject({ status: 500 });
  });
});
