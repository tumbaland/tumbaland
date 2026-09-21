import request from 'supertest';
import app from './app';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'chat-service' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('authentication', () => {
  it.each([
    ['GET', '/api/chat/conversations'],
    ['GET', '/api/chat/unread'],
    ['GET', '/api/chat/search'],
    ['GET', '/api/chat/stream'],
    ['POST', '/api/chat/conversations']
  ])('rejects %s %s with no access token', async (method, path) => {
    const res = await request(app)[method.toLowerCase() as 'get' | 'post'](path);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });

  it('rejects an internal service token: chat has no service-to-service surface', async () => {
    const res = await request(app).get('/api/chat/conversations').set('x-internal-token', 'anything');

    expect(res.status).toBe(401);
  });
});
