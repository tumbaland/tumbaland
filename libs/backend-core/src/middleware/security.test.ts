import express from 'express';
import request from 'supertest';
import { securityHeaders, createRateLimiter } from './security';

describe('securityHeaders', () => {
  const app = express();
  app.use(securityHeaders);
  app.get('/ping', (_req, res) => res.json({ ok: true }));

  it('sets standard helmet protections', async () => {
    const res = await request(app).get('/ping');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('relaxes cross-origin-resource-policy so other-origin frontends can read the response', async () => {
    const res = await request(app).get('/ping');

    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('does not set a Content-Security-Policy header (JSON API, not HTML)', async () => {
    const res = await request(app).get('/ping');

    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});

describe('createRateLimiter', () => {
  it('allows requests under the limit and blocks once the limit is exceeded', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 2 }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    const first = await request(app).get('/ping');
    const second = await request(app).get('/ping');
    const third = await request(app).get('/ping');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({ success: false, message: 'Too many requests, please try again later' });
  });
});
