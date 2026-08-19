// The plan catalog is the one route in this suite that reads the database, and
// with no connection a mongoose query buffers until the test times out. Stubbed
// so the assertion below is about the middleware, which is what it is testing.
jest.mock('./models/Plan', () => ({
  Plan: { find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })) }
}));

import request from 'supertest';
import app from './app';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
});

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'payment-service' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /api/subscriptions/me', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/subscriptions/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });
});

describe('GET /api/plans', () => {
  it('does not reject an anonymous caller — the landing page renders prices before signup', async () => {
    // Mongo is not connected in this suite, so the query fails and the error
    // handler answers. What matters here is that it is not a 401: the route is
    // optionally authenticated, and a pricing table nobody can read without an
    // account is worth nothing.
    const res = await request(app).get('/api/plans');

    expect(res.status).not.toBe(401);
  });

  it('does not reject a caller carrying a stale token either', async () => {
    const res = await request(app).get('/api/plans').set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).not.toBe(401);
  });
});

describe('POST /api/stripe/webhook', () => {
  it('rejects a request missing the stripe-signature header', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' }));

    expect(res.status).toBe(400);
    expect(res.text).toBe('missing signature');
  });

  it('rejects a request with an invalid stripe-signature', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bogus-signature')
      .send(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' }));

    expect(res.status).toBe(400);
    expect(res.text).toMatch(/^Webhook Error:/);
  });
});
