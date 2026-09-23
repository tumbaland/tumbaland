import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import app from '../app';
import { signToken } from '../utils/hmac';

let dataDir: string;

beforeAll(() => {
  process.env.FILE_SERVICE_HMAC_SECRET = 'test-hmac-secret';
});

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-service-public-'));
  process.env.FILE_SERVICE_DATA_DIR = dataDir;
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.FILE_SERVICE_DATA_DIR;
  delete process.env.FILE_SERVICE_MAX_UPLOAD_BYTES;
});

function signedQuery(operation: 'upload' | 'download', fileId: string) {
  const expiresMs = Date.now() + 60_000;
  const token = signToken(operation, fileId, expiresMs);
  return `token=${token}&expires=${expiresMs}`;
}

function stored(fileId: string, contents: string) {
  const full = path.join(dataDir, fileId);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

describe('PUT /files/upload/:fileId (uploadPublic)', () => {
  it('writes the uploaded body to disk and returns success', async () => {
    const fileId = 'group/album/photo.jpg';
    const res = await request(app)
      .put(`/files/upload/${fileId}?${signedQuery('upload', fileId)}`)
      .send(Buffer.from('image bytes'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'File uploaded', fileId });
    expect(fs.readFileSync(path.join(dataDir, fileId), 'utf8')).toBe('image bytes');
  });

  it('refuses a body over the limit, and leaves nothing behind', async () => {
    process.env.FILE_SERVICE_MAX_UPLOAD_BYTES = '10';
    const fileId = 'group/album/big.mp4';

    const res = await request(app)
      .put(`/files/upload/${fileId}?${signedQuery('upload', fileId)}`)
      .send(Buffer.alloc(11));

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/);
    expect(fs.existsSync(path.join(dataDir, fileId))).toBe(false);
  });

  it('counts the bytes itself rather than trusting Content-Length', async () => {
    process.env.FILE_SERVICE_MAX_UPLOAD_BYTES = '10';
    const fileId = 'group/album/chunked.mp4';

    // Chunked, so there is no Content-Length to refuse up front.
    const req = request(app)
      .put(`/files/upload/${fileId}?${signedQuery('upload', fileId)}`)
      .set('Transfer-Encoding', 'chunked');
    req.write(Buffer.alloc(8));
    req.write(Buffer.alloc(8));
    const res = await req;

    expect(res.status).toBe(413);
    expect(fs.readdirSync(path.join(dataDir, 'group/album'))).toEqual([]);
  });

  it('refuses more bytes than the upload was signed for', async () => {
    const fileId = 'group/album/photo.jpg';
    const expiresMs = Date.now() + 60_000;
    const token = signToken('upload', fileId, expiresMs, 5);

    const res = await request(app)
      .put(`/files/upload/${fileId}?token=${token}&expires=${expiresMs}&max=5`)
      .send(Buffer.from('more than five'));

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/bigger than the size given/);
    expect(fs.existsSync(path.join(dataDir, fileId))).toBe(false);
  });

  it('accepts a body within the signed size', async () => {
    const fileId = 'group/album/photo.jpg';
    const expiresMs = Date.now() + 60_000;
    const token = signToken('upload', fileId, expiresMs, 5);

    const res = await request(app)
      .put(`/files/upload/${fileId}?token=${token}&expires=${expiresMs}&max=5`)
      .send(Buffer.from('12345'));

    expect(res.status).toBe(200);
  });

  it('returns 500 when the disk refuses the write', async () => {
    // A file where the folder should be.
    fs.writeFileSync(path.join(dataDir, 'group'), 'x');
    const fileId = 'group/album/photo.jpg';

    const res = await request(app)
      .put(`/files/upload/${fileId}?${signedQuery('upload', fileId)}`)
      .send(Buffer.from('image bytes'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Upload failed' });
  });

  it('rejects with 403 when the signed token was issued for the wrong fileId', async () => {
    const res = await request(app)
      .put(`/files/upload/actual-file.jpg?${signedQuery('upload', 'different-file.jpg')}`)
      .send(Buffer.from('x'));

    expect(res.status).toBe(403);
  });
});

describe('GET /files/download/:fileId (downloadPublic)', () => {
  it('returns 404 when the file does not exist', async () => {
    const fileId = 'missing.jpg';

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('streams the file with a guessed image/jpeg content type', async () => {
    const fileId = 'group/album/photo.jpg';
    stored(fileId, 'jpeg bytes');

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, max-age=3600');
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe('jpeg bytes');
  });

  it('answers a byte range, which iOS needs before it will play a video', async () => {
    const fileId = 'group/album/clip.mp4';
    stored(fileId, '0123456789');

    const res = await request(app)
      .get(`/files/download/${fileId}?${signedQuery('download', fileId)}`)
      .set('Range', 'bytes=2-5')
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 2-5/10');
    expect(res.headers['content-type']).toBe('video/mp4');
    expect((res.body as Buffer).toString()).toBe('2345');
  });

  it('falls back to application/octet-stream for an unrecognized extension', async () => {
    const fileId = 'group/album/file.html';
    stored(fileId, '<script>');

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
  });

  it('does not serve a folder', async () => {
    const fileId = 'group/album';
    stored('group/album/photo.jpg', 'x');

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(404);
  });
});
