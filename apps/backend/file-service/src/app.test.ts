import request from 'supertest';
import app from './app';

describe('GET /health', () => {
  it('reports ok (no DB dependency for this service)', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'file-service' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('internal file routes', () => {
  it('rejects requests missing the internal API key', async () => {
    const res = await request(app).get('/internal/files').query({ prefix: 'x' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
  });

  it('rejects requests with the wrong internal API key', async () => {
    const res = await request(app).get('/internal/files').set('x-internal-api-key', 'wrong-key');

    expect(res.status).toBe(401);
  });
});

describe('public signed download route', () => {
  it('rejects requests missing a signed token', async () => {
    const res = await request(app).get('/files/download/some-file-id');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Missing token or expires' });
  });
});
