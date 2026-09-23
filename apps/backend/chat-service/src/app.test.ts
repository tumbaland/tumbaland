import jwt from 'jsonwebtoken';
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

describe('rate limiting', () => {
  const token = (id: string) => jwt.sign({ id, email: `${id}@example.com`, name: id, groups: [] }, 'test-secret');
  // No groups and no presence write, so this answers without a database.
  const unread = (id: string) =>
    request(app).get('/api/chat/unread?background=1').set('Authorization', `Bearer ${token(id)}`).set('X-Forwarded-For', '10.9.9.9');

  it('counts each person on a shared home connection separately', async () => {
    for (let i = 0; i < 300; i++) await unread('u-tom');

    expect((await unread('u-tom')).status).toBe(429);
    // Same address, other person: her chat still works.
    expect((await unread('u-irja')).status).toBe(200);
  });
});
