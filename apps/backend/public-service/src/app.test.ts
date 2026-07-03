import request from 'supertest';
import app from './app';

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'public-service' });
  });
});

describe('GET /api/todo/random', () => {
  it('returns a todo string loaded from the local todos.json', async () => {
    const res = await request(app).get('/api/todo/random');

    expect(res.status).toBe(200);
    expect(typeof res.body.todo).toBe('string');
    expect(res.body.todo.length).toBeGreaterThan(0);
  });
});
