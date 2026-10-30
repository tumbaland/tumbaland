import request from 'supertest';
import app from './app';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'group-service' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /api/groups', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/groups');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });
});

describe('internal service token bypass', () => {
  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  });

  it('bypasses the JWT check for requests carrying a valid x-internal-token', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('x-internal-token', 'test-internal-token')
      .send({ name: 'Test Group' });

    // Not rejected by the outer JWT check — it reaches the internal-service-aware
    // controller logic instead (which then 400s because no email was supplied).
    expect(res.body.message).not.toBe('Access token required');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'BadRequestError', message: 'User email required' });
  });

  it('rejects an internal token that does not match INTERNAL_SERVICE_TOKEN', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('x-internal-token', 'wrong-token')
      .send({ name: 'Test Group' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or missing internal service token' });
  });
});

describe('GET /internal/groups/:id/owner', () => {
  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  });

  it('rejects a request with no internal token', async () => {
    const res = await request(app).get('/internal/groups/group-1/owner');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or missing internal service token' });
  });

  it('rejects a wrong internal token, rather than trusting the header being present', async () => {
    const res = await request(app).get('/internal/groups/group-1/owner').set('x-internal-token', 'wrong-token');

    expect(res.status).toBe(401);
  });

  it('does not accept a user JWT in place of the service token', async () => {
    const res = await request(app).get('/internal/groups/group-1/owner').set('Authorization', 'Bearer whatever');

    expect(res.status).toBe(401);
  });
});

describe('GET /internal/groups/:id/managers', () => {
  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  });

  it('rejects a request with no internal token', async () => {
    const res = await request(app).get('/internal/groups/group-1/managers');

    expect(res.status).toBe(401);
  });

  it('does not accept a user JWT in place of the service token', async () => {
    const res = await request(app).get('/internal/groups/group-1/managers').set('Authorization', 'Bearer whatever');

    expect(res.status).toBe(401);
  });
});
