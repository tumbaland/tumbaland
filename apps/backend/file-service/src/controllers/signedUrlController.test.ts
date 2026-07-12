import request from 'supertest';
import app from '../app';
import { verifyToken } from '../utils/hmac';

const API_KEY = 'test-api-key';

beforeAll(() => {
  process.env.FILE_SERVICE_API_KEY = API_KEY;
  process.env.FILE_SERVICE_HMAC_SECRET = 'test-hmac-secret';
});

describe('POST /internal/upload-url', () => {
  it('returns a signed, verifiable upload URL using the default 15-minute expiry', async () => {
    const res = await request(app)
      .post('/internal/upload-url')
      .set('x-internal-api-key', API_KEY)
      .send({ fileId: 'a/b/photo.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fileId: 'a/b/photo.jpg', expiresInMinutes: 15 });
    expect(res.body.data.uploadUrl).toContain('/files/upload/a/b/photo.jpg?token=');

    const url = new URL(res.body.data.uploadUrl);
    const token = url.searchParams.get('token')!;
    const expires = Number(url.searchParams.get('expires'));
    expect(verifyToken('upload', 'a/b/photo.jpg', expires, token)).toBe(true);
  });

  it('honors a custom expiresInMinutes', async () => {
    const res = await request(app)
      .post('/internal/upload-url')
      .set('x-internal-api-key', API_KEY)
      .send({ fileId: 'a.jpg', expiresInMinutes: 5 });

    expect(res.body.data.expiresInMinutes).toBe(5);
  });

  it('rejects without a valid internal API key', async () => {
    const res = await request(app).post('/internal/upload-url').send({ fileId: 'a.jpg' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing fileId with a validation error', async () => {
    const res = await request(app).post('/internal/upload-url').set('x-internal-api-key', API_KEY).send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /internal/download-url', () => {
  it('returns a signed, verifiable download URL using the default 60-minute expiry', async () => {
    const res = await request(app)
      .post('/internal/download-url')
      .set('x-internal-api-key', API_KEY)
      .send({ fileId: 'a/b/photo.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fileId: 'a/b/photo.jpg', expiresInMinutes: 60 });

    const url = new URL(res.body.data.downloadUrl);
    const token = url.searchParams.get('token')!;
    const expires = Number(url.searchParams.get('expires'));
    expect(verifyToken('download', 'a/b/photo.jpg', expires, token)).toBe(true);
  });
});

describe('POST /internal/download-urls (batch)', () => {
  it('returns a signed download URL per fileId, all sharing the same expiry', async () => {
    const res = await request(app)
      .post('/internal/download-urls')
      .set('x-internal-api-key', API_KEY)
      .send({ fileIds: ['a.jpg', 'b.jpg'] });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.urls)).toEqual(['a.jpg', 'b.jpg']);
    expect(res.body.data.urls['a.jpg'].expiresMs).toBe(res.body.data.urls['b.jpg'].expiresMs);

    const urlA = new URL(res.body.data.urls['a.jpg'].downloadUrl);
    expect(
      verifyToken('download', 'a.jpg', Number(urlA.searchParams.get('expires')), urlA.searchParams.get('token')!)
    ).toBe(true);
  });

  it('rejects an empty fileIds array', async () => {
    const res = await request(app)
      .post('/internal/download-urls')
      .set('x-internal-api-key', API_KEY)
      .send({ fileIds: [] });

    expect(res.status).toBe(400);
  });

  it('rejects more than 1000 fileIds', async () => {
    const res = await request(app)
      .post('/internal/download-urls')
      .set('x-internal-api-key', API_KEY)
      .send({ fileIds: Array.from({ length: 1001 }, (_, i) => `file-${i}.jpg`) });

    expect(res.status).toBe(400);
  });
});
