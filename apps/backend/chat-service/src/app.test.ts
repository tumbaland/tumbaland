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
  const unread = (id: string, address = '10.9.9.9') =>
    request(app).get('/api/chat/unread?background=1').set('Authorization', `Bearer ${token(id)}`).set('X-Forwarded-For', address);

  it('keeps opening conversations available during sustained normal chat traffic', async () => {
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
    try {
      for (let minute = 0; minute < 15; minute++) {
        clock.mockReturnValue(start + minute * 60_000);
        // Typing, read receipts and fallback polling together, well below a request per second.
        for (let call = 0; call < 45; call++)
          expect((await unread('u-active', '10.9.9.10')).status).toBe(200);
        const opened = await request(app)
          .post('/api/chat/conversations/mine?background=1')
          .set('Authorization', `Bearer ${token('u-active')}`)
          .set('X-Forwarded-For', '10.9.9.10');
        expect(opened.status).toBe(200);
      }
    } finally {
      clock.mockRestore();
    }
  });

  it('counts each person on a shared home connection separately', async () => {
    for (let i = 0; i < 120; i++) await unread('u-tom');

    const blocked = await unread('u-tom');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
    // Same address, other person: her chat still works.
    expect((await unread('u-irja')).status).toBe(200);
  });
});
