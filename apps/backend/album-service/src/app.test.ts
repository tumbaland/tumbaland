import request from 'supertest';
import app from './app';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'album-service', type: 'backend' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /api/albums', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/albums');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });
});
