import request from 'supertest';
import { mintAccessToken, PERSONAL_TENANT, resolveLimits } from '@tumbaland/backend-core';

jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getEntitlements: jest.fn()
}));

import { getEntitlements } from '@tumbaland/backend-core';
import app from '../app';
import { generateToken } from '../test/token';
import { activeDay, at, FORBIDDEN_FIELDS, keysOf, toolCall, user, write } from '../test/seed';
import { clearDb, startDb, stopDb } from '../test/mongo';
import { seedCredentials } from '../test/credentials';

const mockedEntitlements = getEntitlements as unknown as jest.Mock;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  await startDb();
});
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mockedEntitlements.mockImplementation(async (email: string) => ({
    email,
    planCode: 'free',
    status: null,
    limits: resolveLimits('free')
  }));
});

const asAdmin = () => `access_token=${generateToken({ roles: ['admin'] })}`;
const asMember = () => `access_token=${generateToken({ roles: [] })}`;

const ENDPOINTS = ['/api/overview', '/api/users', '/api/users/anything', '/api/assistants', '/api/deletions'];

describe('who may ask', () => {
  it.each(ENDPOINTS)('%s needs a session', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it.each(ENDPOINTS)('%s is refused to someone who is not an administrator', async (path) => {
    const res = await request(app).get(path).set('Cookie', asMember());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'admin required' });
  });

  it.each(ENDPOINTS)('%s is refused to a connected assistant, even the administrator’s', async (path) => {
    const { accessToken } = mintAccessToken({
      userId: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      resource: 'https://mcp.example.com',
      issuer: 'https://auth.example.com',
      scopes: ['relationship:read'],
      tenants: [PERSONAL_TENANT],
      defaultTenant: PERSONAL_TENANT,
      tenantNames: {},
      clientId: 'client-1',
      clientName: 'Test Assistant'
    });

    const res = await request(app).get(path).set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/overview', () => {
  it('answers with the overview, in the usual envelope', async () => {
    const ada = await user('ada@example.com');
    await activeDay(ada.id, new Date().toISOString().slice(0, 10));

    const res = await request(app).get('/api/overview?days=7').set('Cookie', asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.daily).toHaveLength(7);
    expect(res.body.data.active.today).toBe(1);
  });

  it('ignores a days value that is not a number, rather than failing the dashboard', async () => {
    const res = await request(app).get('/api/overview?days=lots').set('Cookie', asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.daily).toHaveLength(30);
  });

  it('keeps days within a year', async () => {
    const res = await request(app).get('/api/overview?days=99999').set('Cookie', asAdmin());

    expect(res.body.data.daily).toHaveLength(365);
  });
});

describe('GET /api/users', () => {
  it('lists the accounts, sorted and paged by the query', async () => {
    await user('ada@example.com');
    await user('bob@example.com');
    await user('cleo@example.com');

    const res = await request(app).get('/api/users?sort=email&order=desc&limit=2&page=1').set('Cookie', asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, totalPages: 2 });
    expect(res.body.data.users.map((row: { email: string }) => row.email)).toEqual(['cleo@example.com', 'bob@example.com']);
  });

  it('searches', async () => {
    await user('ada@example.com');
    await user('bob@example.com');

    const res = await request(app).get('/api/users?q=bob').set('Cookie', asAdmin());

    expect(res.body.data.users.map((row: { email: string }) => row.email)).toEqual(['bob@example.com']);
  });

  it('ignores a sort it does not know and an order that is neither', async () => {
    await user('ada@example.com');

    const res = await request(app).get('/api/users?sort=password&order=sideways&q=%20').set('Cookie', asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});

describe('GET /api/users/:id', () => {
  it('answers with one account in detail', async () => {
    const ada = await user('ada@example.com');

    const res = await request(app).get(`/api/users/${ada.id}`).set('Cookie', asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('ada@example.com');
  });

  it('is 404 for an account that does not exist', async () => {
    const res = await request(app).get('/api/users/not-an-id').set('Cookie', asAdmin());

    expect(res.status).toBe(404);
  });
});

describe('GET /api/assistants and /api/deletions', () => {
  it('answer', async () => {
    const ada = await user('ada@example.com', { deletionRequestedAt: at('2026-10-20T10:00:00Z') });
    await toolCall({ userId: ada.id, at: new Date().toISOString() });

    const assistants = await request(app).get('/api/assistants').set('Cookie', asAdmin());
    const deletions = await request(app).get('/api/deletions').set('Cookie', asAdmin());

    expect(assistants.body.data.totals.calls).toBe(1);
    expect(deletions.body.data.requested.map((entry: { email: string }) => entry.email)).toEqual(['ada@example.com']);
  });
});

describe('what leaves the service', () => {
  it('is only counts, dates and names: no content and no secret, from any endpoint', async () => {
    const ada = await user('ada@example.com', { deletionRequestedAt: at('2026-10-20T10:00:00Z') });
    const today = new Date().toISOString().slice(0, 10);
    await activeDay(ada.id, today, { modules: { album: 1 } });
    await seedCredentials(ada.id);
    await toolCall({ userId: ada.id, at: new Date().toISOString() });
    await write({
      userId: ada.id,
      at: new Date().toISOString(),
      changes: { title: { from: 'private before', to: 'private after' } },
      snapshot: { description: 'a private entry' }
    });

    const responses = await Promise.all(
      [...ENDPOINTS.slice(0, 2), `/api/users/${ada.id}`, ...ENDPOINTS.slice(3)].map((path) =>
        request(app).get(path).set('Cookie', asAdmin())
      )
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
      const keys = keysOf(res.body);
      for (const forbidden of FORBIDDEN_FIELDS) expect(keys.has(forbidden)).toBe(false);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('private before');
      expect(text).not.toContain('a private entry');
      expect(text).not.toContain('secret-hash');
    }
  });
});
