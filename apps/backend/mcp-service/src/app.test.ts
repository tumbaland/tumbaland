jest.mock('@tumbaland/backend-core', () => ({
  // The tenant constants come from the real module rather than being restated
  // here. A hand-listed mock silently dropped PERSONAL_TENANT once, and the code
  // comparing against `undefined` then sent the literal 'personal' to the API as
  // though it were a group id — a mock disagreeing with the library it stands in
  // for, which is the failure this integration keeps hitting.
  //
  // Reached by its own path: requiring the package root pulls in the whole
  // library, and one of its transitive dependencies ships ESM that Jest will not
  // transform. This file has no imports at all.
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
  verifyApiKey: jest.fn(),
  verifyAccessToken: jest.fn(),
  looksLikeApiKey: (t: string) => typeof t === 'string' && t.startsWith('tmb_live_'),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requireEnv: (name: string) => process.env[name] ?? `missing:${name}`
}));

import request from 'supertest';
import { verifyApiKey, verifyAccessToken } from '@tumbaland/backend-core';
import { createApp } from './app';

const mockedVerify = verifyApiKey as jest.Mock;
const mockedVerifyToken = verifyAccessToken as jest.Mock;
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
    expect(res.body.scopes_supported).toEqual([
      'relationship:read',
      'relationship:write',
      'finance:read',
      'finance:write'
    ]);
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
      'delete_activity',
      'edit_activity',
      'get_day',
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

describe('the root and unknown paths', () => {
  it('describes the server at the root, rather than an HTML error page', async () => {
    // This is what anyone types first to check the service is up.
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'tumbaland', transport: 'streamable-http' });
    expect(res.body.endpoint).toMatch(/\/mcp$/);
  });

  it('does not need credentials for the root, since it reveals nothing', async () => {
    const res = await request(app).get('/');
    expect(res.status).not.toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/tmb_live/);
  });

  it('answers an unknown path with JSON, not markup', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toContain('POST /mcp');
  });

  it('answers an unknown method on the MCP path with JSON too', async () => {
    const res = await request(app).get('/mcp');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('tools are gated by the key’s scopes', () => {
  const toolsFor = async (scopes: string[]): Promise<string[]> => {
    mockedVerify.mockResolvedValue({ ok: true, userId: 'u1', keyId: 'k1', scopes, groupId: null });
    const res = await rpc({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
    return (payload.result?.tools ?? []).map((tool: { name: string }) => tool.name).sort();
  };

  it('shows a read-only key only the reading tools', async () => {
    // Advertising log_day to a key that cannot write invites a call that 403s,
    // and a failure the model cannot act on is worse than an absence.
    await expect(toolsFor(['relationship:read'])).resolves.toEqual([
      'get_day',
      'get_stats',
      'list_activity_types',
      'search_activities'
    ]);
  });

  it('shows a read+write key everything', async () => {
    await expect(toolsFor(['relationship:read', 'relationship:write'])).resolves.toEqual([
      'delete_activity',
      'edit_activity',
      'get_day',
      'get_stats',
      'list_activity_types',
      'log_activity',
      'log_day',
      'search_activities'
    ]);
  });

  it('hides the writing tools from a write-only key, which could not resolve a type anyway', async () => {
    await expect(toolsFor(['relationship:write'])).resolves.toEqual([]);
  });

  it('shows nothing for a key scoped to a domain with no tools yet', async () => {
    // Photos have no module, so an album-only key sees an empty surface rather
    // than a list of journal tools it cannot use.
    await expect(toolsFor(['album:read'])).resolves.toEqual([]);
  });

  it('shows a finance-only key the finance tools and nothing else', async () => {
    const tools = await toolsFor(['finance:read']);

    expect(tools).toEqual([
      'get_net_worth',
      'get_portfolio',
      'get_spending',
      'get_spending_trends',
      'list_recurring_payments',
      'search_transactions'
    ]);
  });

  it('keeps the two domains apart on a key that holds both', async () => {
    const tools = await toolsFor(['relationship:read', 'finance:read']);

    expect(tools).toContain('search_activities');
    expect(tools).toContain('search_transactions');
    // Writing is gated separately in each domain, so a read-only pair sees no
    // write tool from either.
    expect(tools).not.toContain('log_day');
    expect(tools).not.toContain('log_trade');
  });

  it('shows nothing for a key with no scopes', async () => {
    await expect(toolsFor([])).resolves.toEqual([]);
  });
});

describe('OAuth access tokens', () => {
  const OAUTH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';

  it('accepts an access token and derives the same context as a key', async () => {
    mockedVerifyToken.mockReturnValue({
      ok: true,
      userId: 'u2',
      email: 'u2@example.com',
      name: 'OAuth User',
      scopes: ['relationship:read'],
      groupId: 'g1'
    });

    const res = await rpc({ jsonrpc: '2.0', id: 20, method: 'tools/list', params: {} }, OAUTH_TOKEN);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
    const names = payload.result.tools.map((t: { name: string }) => t.name).sort();

    // Scope gating applies identically, whichever credential arrived.
    expect(names).toEqual(['get_day', 'get_stats', 'list_activity_types', 'search_activities']);
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('routes by prefix, so a key is never checked as a token', async () => {
    mockedVerify.mockResolvedValue({ ok: true, userId: 'u1', keyId: 'k1', scopes: [], groupId: null });

    await rpc(initialize, KEY);

    expect(mockedVerify).toHaveBeenCalled();
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('refuses an access token minted for a different resource', async () => {
    mockedVerifyToken.mockReturnValue({ ok: false, rejection: 'wrong-audience' });

    const res = await rpc(initialize, OAUTH_TOKEN);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('wrong-audience');
  });

  it('refuses an expired access token', async () => {
    mockedVerifyToken.mockReturnValue({ ok: false, rejection: 'expired' });
    expect((await rpc(initialize, OAUTH_TOKEN)).status).toBe(401);
  });
});

describe('protected resource metadata names the authorization server', () => {
  it('tells a client where to obtain a token', async () => {
    // Without this a spec-compliant client learns that it must authenticate but
    // not how, and the OAuth flow can never start.
    const res = await request(app).get('/.well-known/oauth-protected-resource');
    expect(res.body.authorization_servers?.[0]).toMatch(/^https?:\/\//);
  });
});

describe('listings this server has nothing for', () => {
  const listing = async (method: string) => {
    const res = await rpc({ jsonrpc: '2.0', id: 30, method, params: {} }, KEY);
    return JSON.parse(res.text.split('data: ')[1] ?? '{}');
  };

  it.each([
    ['resources/list', 'resources'],
    ['resources/templates/list', 'resourceTemplates'],
    ['prompts/list', 'prompts']
  ])('answers %s with an empty list rather than "Method not found"', async (method, key) => {
    // A client cannot tell a server with no resources from a broken one. The
    // Claude apps ask during discovery, took the error as a failure, and
    // reported "No matching tools found" for a server whose tools were fine.
    const payload = await listing(method);

    expect(payload.error).toBeUndefined();
    expect(payload.result[key]).toEqual([]);
  });

  it('advertises the capabilities it answers for', async () => {
    const res = await rpc(initialize, KEY);
    const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');

    expect(payload.result.capabilities).toMatchObject({
      tools: expect.anything(),
      resources: expect.anything(),
      prompts: expect.anything()
    });
  });
});

describe('advertised scopes follow the registered modules', () => {
  it('offers only scopes some module can actually serve', async () => {
    // This list is what a client asks the user to approve. Advertising a scope
    // with no tools behind it asks for access that buys them nothing.
    const res = await request(app).get('/.well-known/oauth-protected-resource');

    expect(res.body.scopes_supported).toEqual(
      expect.arrayContaining(['relationship:read', 'relationship:write', 'finance:read', 'finance:write'])
    );
    // Photos have no module yet, so nobody is asked to approve access to them.
    expect(res.body.scopes_supported).not.toContain('album:read');
    expect(res.body.scopes_supported).not.toContain('album:write');
  });
});
