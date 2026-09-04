import { Request, Response } from 'express';

jest.mock('./service', () => ({ verifyApiKey: jest.fn() }));
jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import jwt from 'jsonwebtoken';
import { verifyApiKey } from './service';
import { mintAccessToken, type MintAccessTokenInput } from '../oauth/tokens';
import { PERSONAL_TENANT } from './types';
import { authenticateAgent, requireScope, denyApiKeys } from './middleware';

const mockedVerify = verifyApiKey as jest.Mock;
const ORIGINAL_ENV = process.env;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const req = (over: Partial<Request> = {}): Request =>
  ({ query: {}, body: {}, headers: {}, path: '/activities', ...over }) as unknown as Request;

const withKey = (token = 'tmb_live_abcdef123456_secretsecretsecret', over: Partial<Request> = {}) =>
  req({ headers: { authorization: `Bearer ${token}` }, ...over });

/** A grant of one or more tenants; the first is the default unless said otherwise. */
const grant = (...allowed: string[]) => ({ allowed, default: allowed[0] });

const okVerification = (over: Record<string, unknown> = {}) => ({
  ok: true,
  userId: 'u1',
  userEmail: 'u1@example.com',
  userName: 'Tester',
  keyId: 'k1',
  scopes: ['relationship:read', 'relationship:write'],
  tenants: grant(PERSONAL_TENANT),
  label: 'Claude Code',
  ...over
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-jwt-secret' };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('authenticateAgent — no credentials', () => {
  it('rejects a request with no token', async () => {
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(req(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authenticateAgent — session tokens', () => {
  it('accepts a valid JWT and grants the full session, with no apiKey context', async () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.c', name: 'A', groups: ['g1', 'g2'] }, 'test-jwt-secret');
    const request = req({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();

    await authenticateAgent('relationship:write')(request, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(request.user?.id).toBe('u1');
    // A person keeps every group they belong to — scopes constrain keys, not sessions.
    expect(request.userGroups).toEqual(['g1', 'g2']);
    expect(request.apiKey).toBeUndefined();
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('reads the token from a cookie as well as the header', async () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.c', name: 'A' }, 'test-jwt-secret');
    const request = req({ cookies: { access_token: token } } as Partial<Request>);
    const next = jest.fn();

    await authenticateAgent()(request, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(request.user?.id).toBe('u1');
  });

  it('rejects a JWT signed with the wrong secret', async () => {
    const token = jwt.sign({ id: 'u1' }, 'not-the-secret');
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(req({ headers: { authorization: `Bearer ${token}` } }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authenticateAgent — API keys', () => {
  it('accepts a valid key and populates the request as a session would', async () => {
    mockedVerify.mockResolvedValue(okVerification());
    const request = withKey();
    const next = jest.fn();

    await authenticateAgent('relationship:read')(request, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(request.user).toEqual({ id: 'u1', email: 'u1@example.com', name: 'Tester' });
    expect(request.apiKey).toEqual({
      keyId: 'k1',
      scopes: ['relationship:read', 'relationship:write'],
      tenants: grant(PERSONAL_TENANT),
      actingAs: PERSONAL_TENANT,
      kind: 'api_key',
      // What the owner called it, so a trail reads "Claude Code" not an id.
      label: 'Claude Code',
      credentialId: 'k1'
    });
  });

  it.each([
    ['unknown'], ['revoked'], ['expired'], ['bad-secret'], ['malformed']
  ])('answers a %s key with the same opaque 401', async (rejection) => {
    mockedVerify.mockResolvedValue({ ok: false, rejection });
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(withKey(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    // Nothing in the body distinguishes the five cases — that difference would
    // tell someone guessing which half of the guess was right.
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid or expired credentials'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a key missing a required scope, and names what is missing', async () => {
    mockedVerify.mockResolvedValue(okVerification({ scopes: ['relationship:read'] }));
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent('relationship:write')(withKey(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('relationship:write') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requires every listed scope, not just one of them', async () => {
    mockedVerify.mockResolvedValue(okVerification({ scopes: ['relationship:read'] }));
    const next = jest.fn();

    await authenticateAgent('relationship:read', 'album:write')(withKey(), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
  });
});

it('authenticates a key stored before the owner snapshot existed', async () => {
  // Records written by an earlier version carry no userEmail/userName. Such a
  // key must still work — the id is what every handler actually reads — rather
  // than 500 on a missing field.
  mockedVerify.mockResolvedValue({
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['relationship:read'],
    tenants: grant(PERSONAL_TENANT)
  });
  const request = withKey();
  const next = jest.fn();

  await authenticateAgent('relationship:read')(request, mockRes(), next);

  expect(next).toHaveBeenCalled();
  expect(request.user).toEqual({ id: 'u1', email: '', name: '' });
});

it('treats a verification result with no scopes as granting nothing', async () => {
  mockedVerify.mockResolvedValue({ ok: true, userId: 'u1', keyId: 'k1', tenants: grant(PERSONAL_TENANT) });
  const res = mockRes();
  const next = jest.fn();

  await authenticateAgent('relationship:read')(withKey(), res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

describe('authenticateAgent — a single-tenant grant', () => {
  /**
   * The behaviour a pinned credential always had, kept intact now that a grant
   * is a set. An agent given one tenant should never learn that a tenant is a
   * thing it could name — nothing to choose, nothing to get wrong.
   */
  it('grants a personal key no groups at all', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant(PERSONAL_TENANT) }));
    const request = withKey();

    await authenticateAgent()(request, mockRes(), jest.fn());

    expect(request.userGroups).toEqual([]);
  });

  it('grants a group key exactly its own group, not the owner’s whole membership', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant('g1') }));
    const request = withKey();

    await authenticateAgent()(request, mockRes(), jest.fn());

    expect(request.userGroups).toEqual(['g1']);
  });

  it('fills in the group so the caller never has to know it', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant('g1') }));
    const request = withKey();
    const next = jest.fn();

    await authenticateAgent()(request, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(request.query.groupId).toBe('g1');
    expect((request.body as Record<string, unknown>).groupId).toBe('g1');
  });

  it('refuses a query that names a different group', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant('g1') }));
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(withKey(undefined, { query: { groupId: 'g2' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a body that names a different group', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant('g1') }));
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(withKey(undefined, { body: { groupId: 'g2' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a personal key that tries to reach into a group', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant(PERSONAL_TENANT) }));
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(withKey(undefined, { query: { groupId: 'g1' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a request that names the granted group explicitly', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: grant('g1') }));
    const next = jest.fn();

    await authenticateAgent()(withKey(undefined, { query: { groupId: 'g1' } }), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('authenticateAgent — a multi-tenant grant', () => {
  /**
   * What the set buys: one connection reaching a shared journal and private data
   * without reconnecting. The boundary is unchanged — a tenant outside the grant
   * is still refused — so these tests are about the choice *inside* it.
   */
  const both = { allowed: [PERSONAL_TENANT, 'g1'], default: 'g1' };

  it('acts in the default when the request names nothing', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: both }));
    const request = withKey();

    await authenticateAgent()(request, mockRes(), jest.fn());

    expect(request.query.groupId).toBe('g1');
    expect(request.apiKey?.actingAs).toBe('g1');
  });

  it('acts in another granted tenant when the request names it', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: both }));
    const request = withKey(undefined, { query: { groupId: PERSONAL_TENANT } });

    await authenticateAgent()(request, mockRes(), jest.fn());

    // `personal` is erased rather than passed on: handlers have always read the
    // personal tenant as an absent groupId, and a literal would reach a query as
    // a group that cannot exist.
    expect(request.query.groupId).toBeUndefined();
    expect(request.apiKey?.actingAs).toBe(PERSONAL_TENANT);
  });

  it('erases a stale groupId from the body too, not only the query', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: both }));
    const request = withKey(undefined, { body: { groupId: PERSONAL_TENANT } });

    await authenticateAgent()(request, mockRes(), jest.fn());

    expect((request.body as Record<string, unknown>).groupId).toBeUndefined();
  });

  it('still refuses a tenant outside the grant', async () => {
    mockedVerify.mockResolvedValue(okVerification({ tenants: both }));
    const res = mockRes();
    const next = jest.fn();

    await authenticateAgent()(withKey(undefined, { query: { groupId: 'g2' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('carries every granted group into userGroups, and only those', async () => {
    mockedVerify.mockResolvedValue(
      okVerification({ tenants: { allowed: [PERSONAL_TENANT, 'g1', 'g2'], default: 'g1' } })
    );
    const request = withKey();

    await authenticateAgent()(request, mockRes(), jest.fn());

    // The personal tenant is not a group and must not appear here, or it would
    // reach a `groupId: { $in: ... }` clause as a group nobody belongs to.
    expect(request.userGroups).toEqual(['g1', 'g2']);
  });
});

describe('requireScope', () => {
  const keyReq = (scopes: string[]) =>
    req({
      apiKey: {
        keyId: 'k1',
        scopes,
        tenants: grant(PERSONAL_TENANT),
        actingAs: PERSONAL_TENANT,
        kind: 'api_key' as const,
        label: 'A key',
        credentialId: 'k1'
      }
    } as Partial<Request>);

  it('lets a session through unconditionally', () => {
    // Scopes narrow what software may do on a person's behalf, not what the
    // person may do themselves — a session carries no apiKey context at all.
    const next = jest.fn();
    requireScope('relationship:write')(req(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('lets a key with the required scope through', () => {
    const next = jest.fn();
    requireScope('relationship:read')(keyReq(['relationship:read']), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('refuses a key without it, naming what is missing', () => {
    const res = mockRes();
    const next = jest.fn();

    requireScope('relationship:write')(keyReq(['relationship:read']), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('relationship:write') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('does not let a read scope stand in for a write', () => {
    const next = jest.fn();
    requireScope('album:write')(keyReq(['album:read']), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not let one area’s scope stand in for another’s', () => {
    const next = jest.fn();
    requireScope('finance:read')(keyReq(['relationship:read', 'album:read']), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires every named scope, not just one of them', () => {
    const res = mockRes();
    const next = jest.fn();

    requireScope('relationship:read', 'album:write')(keyReq(['relationship:read']), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('album:write') })
    );
  });

  it('refuses a key with no scopes at all', () => {
    const next = jest.fn();
    requireScope('relationship:read')(keyReq([]), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets any authenticated caller through when no scope is named', () => {
    const next = jest.fn();
    requireScope()(keyReq([]), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('denyApiKeys', () => {
  it('lets a session through', () => {
    const next = jest.fn();
    denyApiKeys(req(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks a request that arrived on a key', () => {
    const res = mockRes();
    const next = jest.fn();

    denyApiKeys(
      req({
        apiKey: {
          keyId: 'k1',
          scopes: [],
          tenants: grant(PERSONAL_TENANT),
          actingAs: PERSONAL_TENANT,
          kind: 'api_key' as const,
          label: 'A key',
          credentialId: 'k1'
        }
      }) as Request,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authenticateAgent — OAuth access tokens', () => {
  /**
   * Minted by the real thing rather than hand-signed. The bug this covers was
   * that an access token verified as a session — same secret, same header — and
   * its claims were then read as a session's: `sub` instead of `id`, no
   * `groups`. Every one of those details has to come from the code that issues
   * them, or the test simply re-encodes whatever the middleware happens to do.
   */
  const mint = (over: Partial<MintAccessTokenInput> = {}) =>
    mintAccessToken({
      userId: 'u1',
      email: 'u1@example.com',
      name: 'Tester',
      resource: 'https://mcp.example.com',
      issuer: 'https://auth.example.com',
      scopes: ['relationship:read', 'relationship:write'],
      tenants: [PERSONAL_TENANT],
      defaultTenant: PERSONAL_TENANT,
      tenantNames: { [PERSONAL_TENANT]: 'My own data' },
      clientId: 'client-1',
      clientName: 'Claude',
      ...over
    }).accessToken;

  const withToken = (token: string, over: Partial<Request> = {}) =>
    req({ headers: { authorization: `Bearer ${token}` }, ...over });

  it('names the user, so scoped queries are bounded', async () => {
    const request = withToken(mint());
    const next = jest.fn();

    await authenticateAgent('relationship:write')(request, mockRes(), next);

    expect(next).toHaveBeenCalled();
    // Read as a session this was `undefined`, which reached handlers as "no
    // user" rather than as a refusal: writes were rejected as inaccessible and
    // reads fell through to an unscoped query.
    expect(request.user?.id).toBe('u1');
    expect(request.user?.email).toBe('u1@example.com');
  });

  it('is held to its scopes, exactly as a key is', async () => {
    const res = mockRes();
    const next = jest.fn();
    const request = withToken(mint({ scopes: ['relationship:read'] }));

    await authenticateAgent('relationship:write')(request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('carries an apiKey context, so requireScope applies downstream', async () => {
    const request = withToken(mint({ scopes: ['relationship:read'] }));

    await authenticateAgent()(request, mockRes(), jest.fn());

    // Without this the token looked like a session and every requireScope on
    // every route waved it through.
    expect(request.apiKey?.scopes).toEqual(['relationship:read']);

    const res = mockRes();
    const next = jest.fn();
    requireScope('relationship:write')(request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('acts in the tenant chosen at consent', async () => {
    const request = withToken(mint({ tenants: ['g1'], defaultTenant: 'g1' }));
    const next = jest.fn();

    await authenticateAgent()(request, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(request.userGroups).toEqual(['g1']);
    // Written in for a caller that named none, so a handler's group branch
    // lands where the person who approved the connection intended.
    expect(request.query.groupId).toBe('g1');
  });

  it('refuses a request naming a different tenant', async () => {
    const res = mockRes();
    const next = jest.fn();
    const request = withToken(mint({ tenants: ['g1'], defaultTenant: 'g1' }), {
      query: { groupId: 'g2' }
    });

    await authenticateAgent()(request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('is refused by denyApiKeys, like any other credential software holds', async () => {
    const request = withToken(mint());
    await authenticateAgent()(request, mockRes(), jest.fn());

    const res = mockRes();
    const next = jest.fn();
    denyApiKeys(request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('never consults the API key store', async () => {
    await authenticateAgent()(withToken(mint()), mockRes(), jest.fn());
    expect(mockedVerify).not.toHaveBeenCalled();
  });
});
