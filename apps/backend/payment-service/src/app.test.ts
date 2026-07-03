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
