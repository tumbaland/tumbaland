import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from './app';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function authCookie() {
  const token = jwt.sign({ id: '1', email: 'user@example.com', name: 'Test User' }, 'test-secret');
  return `access_token=${token}`;
}

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

describe('POST /api/albums (validate() middleware → errorHandler wiring)', () => {
  it('returns 400 via the shared errorHandler when the request body fails schema validation', async () => {
    const res = await request(app).post('/api/albums').set('Cookie', authCookie()).send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'BadRequestError', message: 'name: Album name is required' });
  });
});

describe('rate limit', () => {
  it('lets a connected assistant make far more than the default 300 requests, since they share one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 400; i++) {
      statuses.push((await request(app).get('/api/albums')).status);
    }

    // Refused for want of a token, every time; never for being too many.
    expect(new Set(statuses)).toEqual(new Set([401]));
  }, 60_000);

  it('still has a limit, and says what it is', async () => {
    const res = await request(app).get('/api/albums').set('X-Forwarded-For', '10.9.9.9');
    expect(res.headers['ratelimit-limit']).toBe('3000');
  });
});
