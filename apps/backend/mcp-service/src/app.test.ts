jest.mock('@tumbaland/backend-core', () => ({
  verifyApiKey: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requireEnv: (name: string) => process.env[name] ?? `missing:${name}`
}));

import request from 'supertest';
import { verifyApiKey } from '@tumbaland/backend-core';
import { createApp } from './app';

const mockedVerify = verifyApiKey as jest.Mock;
const app = createApp();

const KEY = 'tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaaaaaa';

/** MCP clients negotiate over JSON-RPC; both content types must be accepted. */
const rpc = (body: unknown, token?: string) => {
  const req = request(app)
    .post('/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body as object);
};

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedVerify.mockResolvedValue({
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['relationship:read', 'relationship:write'],
    groupId: null
  });
});

describe('authentication', () => {
  it('refuses a request with no token', async () => {
    const res = await rpc(initialize);
    expect(res.status).toBe(401);
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('points an unauthenticated client at the protected resource metadata', async () => {
    // Without this header a spec-compliant client has nowhere to go, and it is
    // the hook OAuth discovery will hang off.
    const res = await rpc(initialize);
    expect(res.headers['www-authenticate']).toContain('.well-known/oauth-protected-resource');
  });

  it('refuses a key the verifier rejects', async () => {
    mockedVerify.mockResolvedValue({ ok: false, rejection: 'revoked' });
    const res = await rpc(initialize, KEY);

    expect(res.status).toBe(401);
    // Which of the ways it failed is for the server's log, not the client.
    expect(JSON.stringify(res.body)).not.toContain('revoked');
  });

  it('accepts a valid key', async () => {
    const res = await rpc(initialize, KEY);
    expect(res.status).toBe(200);
    expect(mockedVerify).toHaveBeenCalledWith(KEY);
  });
});

describe('protected resource metadata', () => {
  it('is public, since it is what an unauthenticated client reads first', async () => {
    const res = await request(app).get('/.well-known/oauth-protected-resource');

    expect(res.status).toBe(200);
    expect(res.body.scopes_supported).toEqual(['relationship:read', 'relationship:write']);
  });
});

describe('health', () => {
  it('answers without credentials, for the container probe', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'mcp-service' });
  });
});

describe('the MCP handshake', () => {
  it('initializes and names the server', async () => {
    const res = await rpc(initialize, KEY);

    // Streamable HTTP replies as SSE; the JSON-RPC payload is in the data frame.
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
    expect(payload.result?.serverInfo?.name).toBe('tumbaland');
  });

  it('advertises exactly the intended tool surface', async () => {
    // A small, intent-shaped surface is a deliberate choice: one tool per REST
    // route would bury the two the model needs under thirty near-synonyms.
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
    const names = (payload.result?.tools ?? []).map((tool: { name: string }) => tool.name).sort();

    expect(names).toEqual([
      'get_stats',
      'list_activity_types',
      'log_activity',
      'log_day',
      'search_activities'
    ]);
  });

  it('describes each tool in terms of what a person would ask for', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');

    for (const tool of payload.result?.tools ?? []) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(40);
    }
  });

  it('takes activity types by name, never by id', async () => {
    // The model must never be asked to carry a Mongo ObjectId — it will invent one.
    const res = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
    const logDay = payload.result.tools.find((tool: { name: string }) => tool.name === 'log_day');

    const schema = JSON.stringify(logDay.inputSchema);
    expect(schema).toContain('type');
    expect(schema).not.toContain('typeId');
  });
});

describe('server instructions', () => {
  it('returns guidance on initialize, for clients that inject it', async () => {
    const res = await rpc(initialize, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');

    expect(payload.result?.instructions).toContain('YYYY-MM-DD');
    expect(payload.result?.instructions).toContain('list_activity_types');
  });
});

describe('log_day is additive', () => {
  it('offers replace as an explicit, non-default option', async () => {
    // The endpoint underneath deletes anything absent from the list. An agent
    // asked to "add a walk" cannot know what else is on the day, so the
    // destructive path must be something it opts into, never the default.
    const res = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
    const logDay = payload.result.tools.find((tool: { name: string }) => tool.name === 'log_day');

    expect(logDay.inputSchema.properties.replace).toBeDefined();
    expect(logDay.inputSchema.required ?? []).not.toContain('replace');
    expect(JSON.stringify(logDay.inputSchema.properties.replace)).toMatch(/destructive/i);
  });
});
