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
    expect(res.body).toMatchObject({ status: 'error', service: 'finance-service', type: 'backend' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /api/user-portfolio', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/user-portfolio');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });
});

describe('GET /api/tracked-tickers/search (typed-error → errorHandler wiring)', () => {
  it('returns 400 via the shared errorHandler when the query is too short, with no try/catch in the controller', async () => {
    const res = await request(app)
      .get('/api/tracked-tickers/search')
      .set('Cookie', authCookie())
      .query({ q: 'a' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'BadRequestError',
      message: 'Query must be at least 2 characters'
    });
  });
});
