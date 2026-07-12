import express from 'express';
import request from 'supertest';
import { createCorsMiddleware } from './corsMiddleware';
import { errorHandler } from './errorHandler';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

function buildApp(origins: string) {
  const app = express();
  app.use(createCorsMiddleware({ origins }));
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('createCorsMiddleware', () => {
  const app = buildApp('https://allowed.example,https://also-allowed.example');

  it('allows a request with no Origin header (server-to-server / health checks)', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('allows a whitelisted origin and echoes it back with credentials', async () => {
    const res = await request(app).get('/ping').set('Origin', 'https://allowed.example');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects an origin not on the whitelist', async () => {
    const res = await request(app).get('/ping').set('Origin', 'https://evil.example');

    expect(res.status).toBe(500);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('falls back to process.env.CORS_ORIGIN when no origins option is given', async () => {
    const ORIGINAL_ENV = process.env;
    process.env = { ...ORIGINAL_ENV, CORS_ORIGIN: 'https://from-env.example' };

    const envApp = express();
    envApp.use(createCorsMiddleware());
    envApp.get('/ping', (_req, res) => res.json({ ok: true }));
    envApp.use(errorHandler);

    const res = await request(envApp).get('/ping').set('Origin', 'https://from-env.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://from-env.example');

    process.env = ORIGINAL_ENV;
  });
});
