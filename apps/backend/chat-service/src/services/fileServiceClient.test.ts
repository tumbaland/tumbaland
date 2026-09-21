jest.mock('@tumbaland/backend-core', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() }
}));

import {
  deleteFolder,
  downloadBuffer,
  getDownloadUrls,
  getUploadUrl,
  uploadBuffer
} from './fileServiceClient';

const fetchMock = jest.fn();

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  arrayBuffer: async () => new TextEncoder().encode('bytes').buffer
});

beforeEach(() => {
  process.env.FILE_SERVICE_URL = 'http://file-service:5002';
  process.env.FILE_SERVICE_API_KEY = 'test-key';
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue(ok({ data: {} }));
});

afterEach(() => jest.clearAllMocks());

const lastCall = () => fetchMock.mock.calls.at(-1)!;

describe('authentication', () => {
  it('sends the internal API key on every call', async () => {
    fetchMock.mockResolvedValue(ok({ data: { uploadUrl: 'https://x' } }));

    await getUploadUrl('chat/g1/c1/a/original.jpg', 'image/jpeg');

    expect(lastCall()[1].headers['X-Internal-Api-Key']).toBe('test-key');
  });

  it('refuses to run without a key rather than calling unauthenticated', async () => {
    delete process.env.FILE_SERVICE_API_KEY;

    await expect(getUploadUrl('f', 'image/jpeg')).rejects.toThrow(/FILE_SERVICE_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('strips a trailing slash from the base URL, so paths never double up', async () => {
    process.env.FILE_SERVICE_URL = 'http://file-service:5002/';
    fetchMock.mockResolvedValue(ok({ data: { uploadUrl: 'https://x' } }));

    await getUploadUrl('f', 'image/jpeg');

    expect(lastCall()[0]).toBe('http://file-service:5002/internal/upload-url');
  });
});

describe('getUploadUrl', () => {
  it('returns the signed URL', async () => {
    fetchMock.mockResolvedValue(ok({ data: { uploadUrl: 'https://files/upload?token=x' } }));

    expect(await getUploadUrl('chat/g1/c1/a/original.jpg', 'image/jpeg')).toBe('https://files/upload?token=x');
  });

  it('throws on a refusal, so the caller does not hand the browser a dead URL', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    await expect(getUploadUrl('f', 'image/jpeg')).rejects.toThrow(/403/);
  });
});

describe('getDownloadUrls', () => {
  it('asks for every id in one call', async () => {
    fetchMock.mockResolvedValue(ok({ data: { urls: { f1: { downloadUrl: 'u1' }, f2: { downloadUrl: 'u2' } } } }));

    const urls = await getDownloadUrls(['f1', 'f2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls.get('f1')).toBe('u1');
    expect(urls.get('f2')).toBe('u2');
  });

  it('deduplicates ids before asking', async () => {
    fetchMock.mockResolvedValue(ok({ data: { urls: {} } }));

    await getDownloadUrls(['f1', 'f1', 'f2']);

    expect(JSON.parse(lastCall()[1].body).fileIds).toEqual(['f1', 'f2']);
  });

  it('calls nothing for an empty list', async () => {
    expect((await getDownloadUrls([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty map instead of throwing when file-service is down', async () => {
    // A thread that renders without its images beats one that fails to load.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    expect((await getDownloadUrls(['f1'])).size).toBe(0);
  });

  it('returns an empty map on a refusal', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    expect((await getDownloadUrls(['f1'])).size).toBe(0);
  });
});

describe('uploadBuffer', () => {
  it('PUTs the bytes with their own content type', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await uploadBuffer('chat/g1/c1/a/thumb.webp', Buffer.from('x'), 'image/webp');

    const [url, init] = lastCall();
    expect(url).toBe('http://file-service:5002/internal/files/chat/g1/c1/a/thumb.webp');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('image/webp');
  });

  it('throws when the write is refused', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(uploadBuffer('f', Buffer.from('x'), 'image/webp')).rejects.toThrow(/500/);
  });
});

describe('downloadBuffer', () => {
  it('returns the file as a Buffer', async () => {
    fetchMock.mockResolvedValue(ok({}));

    expect((await downloadBuffer('f')).toString()).toBe('bytes');
  });

  it('throws when the file is missing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(downloadBuffer('f')).rejects.toThrow(/404/);
  });
});

describe('deleteFolder', () => {
  it('removes everything under one prefix', async () => {
    fetchMock.mockResolvedValue(ok({ success: true }));

    await deleteFolder('chat/g1/c1/abc');

    const [url, init] = lastCall();
    expect(url).toBe('http://file-service:5002/internal/files/folder');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ prefix: 'chat/g1/c1/abc' });
  });

  it('throws when the delete is refused', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(deleteFolder('chat/g1/c1/abc')).rejects.toThrow(/500/);
  });
});
