import request from 'supertest';
import app from './app';

beforeAll(() => {
  process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
});

describe('GET /health', () => {
  it('reports unhealthy when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', service: 'auth-service', type: 'backend' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /auth/verify', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/auth/verify');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });
});

describe('POST /auth/validate', () => {
  it('is mounted as a public route (does not 401 before hitting the handler)', async () => {
    const res = await request(app).post('/auth/validate').send({});

    expect(res.status).not.toBe(401);
  });

  it('is strictly rate-limited against brute-forcing token issuance', async () => {
    let sawTooManyRequests = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/auth/validate').send({});
      if (res.status === 429) {
        sawTooManyRequests = true;
        break;
      }
    }
    expect(sawTooManyRequests).toBe(true);
  });
});

describe('POST /auth/internal/invalidate-tokens', () => {
  it('rejects requests with no internal service token', async () => {
    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or missing internal service token' });
  });

  it('rejects an internal token that does not match INTERNAL_SERVICE_TOKEN', async () => {
    const res = await request(app)
      .post('/auth/internal/invalidate-tokens')
      .set('x-internal-token', 'wrong-token')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid or missing internal service token' });
  });
});

describe('/auth/api-keys', () => {
  const routes: [string, string][] = [
    ['get', '/auth/api-keys'],
    ['post', '/auth/api-keys'],
    ['post', '/auth/api-keys/k1/reveal'],
    ['post', '/auth/api-keys/k1/revoke'],
    ['delete', '/auth/api-keys/k1']
  ];

  it.each(routes)('%s %s requires authentication', async (method, path) => {
    const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[method](path);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });

  it.each(routes)('%s %s refuses an API key, so a key can never mint another', async (method, path) => {
    // Key management stays a person's job: these routes are behind the JWT-only
    // middleware, so a well-formed key fails signature verification.
    const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[method](path)
      .set('Authorization', 'Bearer tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaaaaaa');

    expect(res.status).toBe(401);
  });

  it('answers an anonymous caller with 401, never leaking whether the server can encrypt', async () => {
    // The configuration guard sits behind authentication on purpose — a 503
    // naming API_KEY_ENCRYPTION_SECRET would tell an unauthenticated prober
    // about the server's setup.
    const original = process.env.API_KEY_ENCRYPTION_SECRET;
    delete process.env.API_KEY_ENCRYPTION_SECRET;

    try {
      const res = await request(app).get('/auth/api-keys');
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('API_KEY_ENCRYPTION_SECRET');
    } finally {
      process.env.API_KEY_ENCRYPTION_SECRET = original;
    }
  });

  it('never lets an unauthenticated caller reach the reveal rate limiter', async () => {
    // The limiter is mounted after authentication, so repeated anonymous
    // attempts are turned away by auth every time and never consume anyone's
    // rate-limit budget. A 429 here would mean the order had been swapped and
    // an anonymous caller could exhaust the limit for a real user.
    const statuses = new Set<number>();
    for (let i = 0; i < 25; i++) {
      statuses.add((await request(app).post('/auth/api-keys/k1/reveal')).status);
    }

    expect([...statuses]).toEqual([401]);
  });
});

describe('OAuth endpoints', () => {
  it('publishes authorization server metadata at the issuer root', async () => {
    // RFC 8414 says a client looks here; nested under /auth it would never be found.
    const res = await request(app).get('/.well-known/oauth-authorization-server');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
      authorization_response_iss_parameter_supported: true
    });
    expect(res.body.authorization_endpoint).toMatch(/\/oauth\/authorize$/);
    expect(res.body.token_endpoint).toMatch(/\/oauth\/token$/);
  });

  it('advertises S256 only, since OAuth 2.1 removes plain PKCE', async () => {
    const res = await request(app).get('/.well-known/oauth-authorization-server');
    expect(res.body.code_challenge_methods_supported).not.toContain('plain');
  });

  it('serves the metadata without credentials, as the first thing a client reads', async () => {
    expect((await request(app).get('/.well-known/oauth-authorization-server')).status).not.toBe(401);
  });

  it('rejects a registration with no redirect_uris', async () => {
    const res = await request(app).post('/oauth/register').send({ client_name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-loopback http redirect_uri', async () => {
    // Anything on the public internet must be https; loopback is allowed
    // because that is how local MCP clients call back.
    const res = await request(app)
      .post('/oauth/register')
      .send({ client_name: 'Test', redirect_uris: ['http://evil.example/cb'] });

    expect(res.status).toBe(400);
  });

  it('rejects an authorize request with no client_id, rather than redirecting', async () => {
    // Bouncing to an unverified redirect_uri is how an open redirect is built.
    const res = await request(app).get('/oauth/authorize?redirect_uri=https://evil.example/cb');

    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('rejects an unsupported grant_type with an OAuth error code', async () => {
    const res = await request(app)
      .post('/oauth/token')
      .type('form')
      .send({ grant_type: 'password', client_id: 'c1' });

    // Clients parse these; prose in a 400 tells them nothing.
    expect(res.body.error).toBe('unsupported_grant_type');
  });

  it('rejects a token request with no client_id', async () => {
    const res = await request(app).post('/oauth/token').type('form').send({ grant_type: 'refresh_token' });
    expect(res.body.error).toBe('invalid_client');
  });
});

describe('/auth/connections', () => {
  it.each([
    ['get', '/auth/connections'],
    ['delete', '/auth/connections/tmb-client-abc']
  ])('%s %s requires an interactive session', async (method, path) => {
    const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('consent CSRF protection', () => {
  it('requires a session to submit a decision, not just a cookie-shaped request', async () => {
    // Unlike the GET, there is no anonymous path here — anyone posting a
    // decision has already been through login.
    const res = await request(app)
      .post('/oauth/authorize')
      .type('form')
      .send({ decision: 'approve', client_id: 'c1', redirect_uri: 'https://claude.ai/cb' });

    expect(res.status).toBe(401);
  });

  it('does not redirect an unauthenticated decision to the client URI', async () => {
    // Redirecting would confirm to an attacker that their forged submission
    // reached the server.
    const res = await request(app)
      .post('/oauth/authorize')
      .type('form')
      .send({ decision: 'approve', client_id: 'c1', redirect_uri: 'https://evil.example/cb' });

    expect(res.headers.location).toBeUndefined();
  });
});
