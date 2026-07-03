import request from 'supertest';
import { createBaseApp } from './createBaseApp';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

describe('createBaseApp', () => {
  it('parses JSON bodies and cookies by default', async () => {
    const app = createBaseApp();
    app.get('/echo-cookie', (req, res) => res.json({ cookies: req.cookies }));
    app.post('/echo-body', (req, res) => res.json({ body: req.body }));

    const cookieRes = await request(app).get('/echo-cookie').set('Cookie', 'foo=bar');
    expect(cookieRes.body).toEqual({ cookies: { foo: 'bar' } });

    const bodyRes = await request(app).post('/echo-body').send({ hello: 'world' });
    expect(bodyRes.body).toEqual({ body: { hello: 'world' } });
  });

  it('applies security headers and rate limiting', async () => {
    const app = createBaseApp();
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/ping');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('skips JSON parsing when parseJson is false', async () => {
    const app = createBaseApp({ parseJson: false });
    app.post('/echo-body', (req, res) => res.json({ body: req.body ?? null }));

    const res = await request(app).post('/echo-body').set('Content-Type', 'application/json').send('{"hello":"world"}');
    expect(res.body).toEqual({ body: null });
  });

  it('skips cookie parsing when parseCookies is false', async () => {
    const app = createBaseApp({ parseCookies: false });
    app.get('/echo-cookie', (req, res) => res.json({ cookies: req.cookies ?? null }));

    const res = await request(app).get('/echo-cookie').set('Cookie', 'foo=bar');
    expect(res.body).toEqual({ cookies: null });
  });

  it('honors a custom rate limiter', async () => {
    const app = createBaseApp({ rateLimiter: (await import('../middleware/security')).createRateLimiter({ windowMs: 60_000, max: 1 }) });
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    const first = await request(app).get('/ping');
    const second = await request(app).get('/ping');

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
