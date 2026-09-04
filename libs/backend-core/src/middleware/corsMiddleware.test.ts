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

  describe('the preflight', () => {
    const preflight = (method: string) =>
      request(app)
        .options('/ping')
        .set('Origin', 'https://allowed.example')
        .set('Access-Control-Request-Method', method);

    // A method left out here is the worst kind of CORS failure: the preflight
    // returns 204, so the network tab shows nothing failing, and the browser
    // quietly refuses to send the request it just asked about.
    it.each([['GET'], ['POST'], ['PUT'], ['PATCH'], ['DELETE']])('permits %s', async (method) => {
      const res = await preflight(method);

      expect(res.headers['access-control-allow-methods'].split(',')).toContain(method);
    });

    it('does not advertise a method the services do not serve', async () => {
      const res = await preflight('GET');

      expect(res.headers['access-control-allow-methods']).not.toContain('TRACE');
    });
  });

  it('exposes only the response headers a caller asks for', async () => {
    // Cross-origin JavaScript cannot read a header that is not exposed — the
    // CSV export reads its filename out of Content-Disposition
    const exposing = express();
    exposing.use(createCorsMiddleware({
      origins: 'https://allowed.example',
      exposedHeaders: ['Content-Disposition']
    }));
    exposing.get('/ping', (_req, res) => res.json({ ok: true }));

    const res = await request(exposing).get('/ping').set('Origin', 'https://allowed.example');

    expect(res.headers['access-control-expose-headers']).toBe('Content-Disposition');
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

describe('bypassPaths', () => {
  const run = (middleware: ReturnType<typeof createCorsMiddleware>, path: string, origin?: string) => {
    const req = { path, method: 'POST', headers: origin ? { origin } : {} } as never;
    const res = { setHeader: jest.fn(), getHeader: jest.fn(), end: jest.fn() } as never;
    const next = jest.fn();
    middleware(req, res, next);
    return next;
  };

  it('lets a bypassed path through with an origin that would otherwise be blocked', () => {
    // Firefox sends a literal `Origin: null` on the consent form POST after the
    // login redirect. It is truthy, matches no whitelist entry, and turned an
    // approved consent into a 500.
    const middleware = createCorsMiddleware({ origins: 'https://app.example', bypassPaths: ['/oauth'] });

    const next = run(middleware, '/oauth/authorize', 'null');

    expect(next).toHaveBeenCalledWith();
  });

  it('still checks the origin on every other path', () => {
    const middleware = createCorsMiddleware({ origins: 'https://app.example', bypassPaths: ['/oauth'] });

    const next = run(middleware, '/auth/profile', 'null');

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('CORS') }));
  });

  it('matches by prefix, so nested oauth routes are covered too', () => {
    const middleware = createCorsMiddleware({ origins: 'https://app.example', bypassPaths: ['/oauth'] });
    expect(run(middleware, '/oauth/token', 'null')).toHaveBeenCalledWith();
  });

  it('changes nothing when no bypass is configured', () => {
    const middleware = createCorsMiddleware({ origins: 'https://app.example' });
    expect(run(middleware, '/oauth/authorize', 'null')).toHaveBeenCalledWith(expect.any(Error));
  });
});
