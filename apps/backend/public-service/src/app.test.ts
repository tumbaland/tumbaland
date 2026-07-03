import request from 'supertest';
import app from './app';

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'public-service' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /api/todo/random', () => {
  it('returns a todo string loaded from the local todos.json', async () => {
    const res = await request(app).get('/api/todo/random');

    expect(res.status).toBe(200);
    expect(typeof res.body.todo).toBe('string');
    expect(res.body.todo.length).toBeGreaterThan(0);
  });

  it('is strictly rate-limited', async () => {
    let sawTooManyRequests = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app).get('/api/todo/random');
      if (res.status === 429) {
        sawTooManyRequests = true;
        break;
      }
    }
    expect(sawTooManyRequests).toBe(true);
  });
});

describe('POST /logs', () => {
  it('is not subject to the strict limiter (only the standard baseline)', async () => {
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/logs').send({ level: 'info', message: 'test log' });
      expect(res.status).not.toBe(429);
    }
  });
});
