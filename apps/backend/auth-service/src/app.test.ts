import request from 'supertest';
import app from './app';

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'auth-service', type: 'backend' });
  });
});

describe('GET /auth/verify', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/auth/verify');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });
});

describe('POST /auth/validate', () => {
  it('is mounted as a public route (does not 401 before hitting the handler)', async () => {
    const res = await request(app).post('/auth/validate').send({});

    expect(res.status).not.toBe(401);
  });
});
