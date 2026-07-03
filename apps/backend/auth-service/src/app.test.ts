import request from 'supertest';
import app from './app';

beforeAll(() => {
  process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
});

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'auth-service', type: 'backend' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
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

  it('is strictly rate-limited against brute-forcing token issuance', async () => {
    let sawTooManyRequests = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/auth/validate').send({});
      if (res.status === 429) {
        sawTooManyRequests = true;
        break;
      }
    }
    expect(sawTooManyRequests).toBe(true);
  });
});

describe('POST /auth/internal/invalidate-tokens', () => {
  it('rejects requests with no internal service token', async () => {
    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or missing internal service token' });
  });

  it('rejects an internal token that does not match INTERNAL_SERVICE_TOKEN', async () => {
    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .set('x-internal-token', 'wrong-token')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or missing internal service token' });
  });
});
