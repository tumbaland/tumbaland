import { createHash } from 'crypto';

/** Read a minted token's claims without a verify — the signature is not the point here. */
const decodeJwt = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

import { Request, Response } from 'express';

jest.mock('@tumbaland/backend-core', () => {
  const actual = jest.requireActual('@tumbaland/backend-core');
  return {
    ...actual,
    findClient: jest.fn(),
    registerClient: jest.fn(),
    issueAuthorizationCode: jest.fn(),
    redeemAuthorizationCode: jest.fn(),
    issueRefreshToken: jest.fn(),
    redeemRefreshToken: jest.fn(),
    listConnections: jest.fn(),
    revokeRefreshTokensForUser: jest.fn(),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
  };
});

import {
  findClient,
  registerClient,
  issueAuthorizationCode,
  redeemAuthorizationCode,
  issueRefreshToken,
  redeemRefreshToken,
  listConnections,
  revokeRefreshTokensForUser
} from '@tumbaland/backend-core';
import {
  authorizationServerMetadata,
  registerOAuthClient,
  authorize,
  authorizeDecision,
  token,
  getConnections,
  revokeConnection
} from './oauthController';

const mockedFindClient = findClient as jest.Mock;
const mockedRegister = registerClient as jest.Mock;
const mockedIssueCode = issueAuthorizationCode as jest.Mock;
const mockedRedeemCode = redeemAuthorizationCode as jest.Mock;
const mockedIssueRefresh = issueRefreshToken as jest.Mock;
const mockedRedeemRefresh = redeemRefreshToken as jest.Mock;
const mockedListConnections = listConnections as jest.Mock;
const mockedRevoke = revokeRefreshTokensForUser as jest.Mock;

const ORIGINAL_ENV = process.env;
const RESOURCE = 'https://mcp.tumbaland.eu';
const ISSUER = 'https://auth-api.tumbaland.eu';
const REDIRECT = 'https://claude.ai/callback';
const VERIFIER = 'a-code-verifier-long-enough-to-be-real';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
}

const user = { id: 'u1', email: 'u1@example.com', name: 'Tester' };

const authorizeReq = (over: Record<string, string> = {}, signedIn = true): Request =>
  ({
    query: {
      client_id: 'client-1',
      redirect_uri: REDIRECT,
      response_type: 'code',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      resource: RESOURCE,
      scope: 'relationship:read relationship:write',
      state: 'xyz',
      ...over
    },
    originalUrl: '/oauth/authorize?client_id=client-1',
    user: signedIn ? user : undefined,
    userGroups: ['g1']
  }) as unknown as Request;

/** Pull the consent token out of the rendered form, as a browser would. */
const consentTokenFrom = (res: Response): string => {
  const html = (res.send as jest.Mock).mock.calls[0][0] as string;
  return /name="consent_token" value="([a-f0-9]+)"/.exec(html)![1];
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    JWT_SECRET: 'test-jwt-secret',
    AUTH_SERVICE_PUBLIC_URL: ISSUER,
    MCP_PUBLIC_URL: RESOURCE,
    AUTH_FRONT_URL: 'https://auth.tumbaland.eu'
  };
  mockedFindClient.mockResolvedValue({
    clientId: 'client-1',
    clientName: 'Claude',
    redirectUris: [REDIRECT]
  });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('authorizationServerMetadata', () => {
  it('names its own endpoints off the configured issuer', () => {
    const res = mockRes();
    authorizationServerMetadata({} as Request, res);

    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth/authorize`,
      token_endpoint: `${ISSUER}/oauth/token`,
      code_challenge_methods_supported: ['S256']
    });
  });
});

describe('registerOAuthClient', () => {
  it('registers a client and echoes it in RFC 7591 shape', async () => {
    mockedRegister.mockResolvedValue({
      clientId: 'client-9',
      clientName: 'Claude',
      redirectUris: [REDIRECT]
    });
    const res = mockRes();

    await registerOAuthClient(
      { body: { client_name: 'Claude', redirect_uris: [REDIRECT] } } as Request,
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      client_id: 'client-9',
      token_endpoint_auth_method: 'none'
    });
  });

  it('accepts a loopback redirect, which is how local clients call back', async () => {
    mockedRegister.mockResolvedValue({ clientId: 'c', clientName: 'x', redirectUris: [] });

    await expect(
      registerOAuthClient(
        { body: { redirect_uris: ['http://127.0.0.1:6274/oauth/callback'] } } as Request,
        mockRes()
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    ['no redirect_uris', {}],
    ['an empty list', { redirect_uris: [] }],
    ['plain http on the internet', { redirect_uris: ['http://evil.example/cb'] }]
  ])('rejects %s', async (_label, body) => {
    await expect(registerOAuthClient({ body } as Request, mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });
});

describe('authorize', () => {
  it('sends an unauthenticated visitor through the ordinary login and back', async () => {
    const res = mockRes();
    await authorize(authorizeReq({}, false), res);

    const [target] = (res.redirect as jest.Mock).mock.calls[0];
    expect(target).toContain('https://auth.tumbaland.eu');
    expect(decodeURIComponent(target)).toContain('/oauth/authorize?client_id=client-1');
  });

  it('renders a consent screen naming the client and what it asks for', async () => {
    const res = mockRes();
    await authorize(authorizeReq(), res);

    const html = (res.send as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain('Claude');
    expect(html).toContain('Read your journal');
    expect(html).toContain('Add to and change your journal');
    expect(html).toContain('u1@example.com');
  });

  it('offers every tenant at once, since one connection may need both', async () => {
    const res = mockRes();
    await authorize(authorizeReq(), res);

    const html = (res.send as jest.Mock).mock.calls[0][0] as string;
    // Checkboxes, not a single-choice select: making someone pick one and
    // reconnect to change their mind is the thing this replaced.
    expect(html).toContain('name="tenant" value="personal"');
    expect(html).toContain('name="tenant" value="g1"');
    expect(html).toContain('name="defaultTenant"');
    expect(html).toContain('My own data');
  });

  it('falls back to a legible label when group names cannot be fetched', async () => {
    // A consent screen that will not render because a sibling service is slow
    // is worse than one with an ugly label on it.
    const res = mockRes();
    await authorize(authorizeReq(), res);

    const html = (res.send as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain('value="g1"');
  });

  it('carries a consent token bound to this request', async () => {
    const res = mockRes();
    await authorize(authorizeReq(), res);
    expect(consentTokenFrom(res)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ['no client_id', { client_id: '' }],
    ['a response_type other than code', { response_type: 'token' }],
    ['no PKCE challenge', { code_challenge: '' }],
    ['plain PKCE, which OAuth 2.1 removes', { code_challenge_method: 'plain' }],
    ['no resource', { resource: '' }],
    ['a resource this server does not serve', { resource: 'https://mcp.elsewhere.example' }],
    ['no recognised scope', { scope: 'admin:everything' }]
  ])('refuses %s', async (_label, over) => {
    await expect(authorize(authorizeReq(over), mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('refuses a redirect_uri the client never registered, without redirecting', async () => {
    // Bouncing to an unverified URI is how an open redirect is built, so this
    // error reaches the user rather than the caller.
    const res = mockRes();
    await expect(
      authorize(authorizeReq({ redirect_uri: 'https://evil.example/cb' }), res)
    ).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('refuses an unknown client', async () => {
    mockedFindClient.mockResolvedValue(null);
    await expect(authorize(authorizeReq(), mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });
});

describe('authorizeDecision', () => {
  const decisionReq = async (over: Record<string, unknown> = {}): Promise<Request> => {
    // Render the form first so the consent token is a real one.
    const rendered = mockRes();
    await authorize(authorizeReq(), rendered);

    return {
      body: {
        decision: 'approve',
        client_id: 'client-1',
        redirect_uri: REDIRECT,
        scope: 'relationship:read relationship:write',
        resource: RESOURCE,
        code_challenge: CHALLENGE,
        state: 'xyz',
        tenant: ['personal', 'g1'],
        defaultTenant: 'g1',
        consent_token: consentTokenFrom(rendered),
        ...over
      },
      user,
      userGroups: ['g1']
    } as unknown as Request;
  };

  it('issues a code and returns it with the state and issuer', async () => {
    mockedIssueCode.mockResolvedValue('the-code');
    const res = mockRes();

    await authorizeDecision(await decisionReq(), res);

    const [target] = (res.redirect as jest.Mock).mock.calls[0];
    const url = new URL(target);
    expect(url.searchParams.get('code')).toBe('the-code');
    expect(url.searchParams.get('state')).toBe('xyz');
    // RFC 9207: naming ourselves lets the client detect a mix-up attack.
    expect(url.searchParams.get('iss')).toBe(ISSUER);
  });

  it('records every tenant the user ticked, and the default among them', async () => {
    mockedIssueCode.mockResolvedValue('c');

    await authorizeDecision(await decisionReq(), mockRes());

    expect(mockedIssueCode.mock.calls[0][0]).toMatchObject({
      tenants: ['g1', 'personal'],
      defaultTenant: 'g1'
    });
  });

  it('records one tenant when only one was ticked', async () => {
    mockedIssueCode.mockResolvedValue('c');

    await authorizeDecision(
      await decisionReq({ tenant: ['g1'], defaultTenant: 'g1' }),
      mockRes()
    );

    expect(mockedIssueCode.mock.calls[0][0]).toMatchObject({
      tenants: ['g1'],
      defaultTenant: 'g1'
    });
  });

  it('drops a tenant the approver is not in', async () => {
    // Otherwise the tenant field would be a way into someone else's data: the
    // form is the approver's, but the request carrying it is the client's.
    mockedIssueCode.mockResolvedValue('c');

    await authorizeDecision(
      await decisionReq({ tenant: ['g1', 'g99'], defaultTenant: 'g1' }),
      mockRes()
    );

    expect(mockedIssueCode.mock.calls[0][0].tenants).toEqual(['g1']);
  });

  it('refuses a default outside the approver’s reach, rather than honouring it', async () => {
    mockedIssueCode.mockResolvedValue('c');

    await authorizeDecision(
      await decisionReq({ tenant: ['g1'], defaultTenant: 'g99' }),
      mockRes()
    );

    expect(mockedIssueCode.mock.calls[0][0].defaultTenant).toBe('personal');
  });

  it('never grants an empty set, which would authenticate and then fail everything', async () => {
    mockedIssueCode.mockResolvedValue('c');

    // Nothing ticked: the default alone still forms the grant.
    await authorizeDecision(
      await decisionReq({ tenant: undefined, defaultTenant: 'g1' }),
      mockRes()
    );

    expect(mockedIssueCode.mock.calls[0][0].tenants).toEqual(['g1']);
  });

  it('carries what each granted tenant is called, for a client that must offer the choice', async () => {
    mockedIssueCode.mockResolvedValue('c');

    await authorizeDecision(await decisionReq(), mockRes());

    expect(Object.keys(mockedIssueCode.mock.calls[0][0].tenantNames)).toEqual(['g1', 'personal']);
  });

  it('returns access_denied when the user cancels, and issues nothing', async () => {
    const res = mockRes();
    await authorizeDecision(await decisionReq({ decision: 'deny' }), res);

    const url = new URL((res.redirect as jest.Mock).mock.calls[0][0]);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(mockedIssueCode).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing consent token', { consent_token: undefined }],
    ['a forged consent token', { consent_token: 'f'.repeat(64) }]
  ])('refuses %s outright rather than redirecting', async (_label, over) => {
    // A submission that fails here is not a user decision. Redirecting an error
    // would confirm to an attacker that their forged post was received.
    const res = mockRes();

    await expect(authorizeDecision(await decisionReq(over), res)).rejects.toMatchObject({
      name: 'BadRequestError'
    });
    expect(res.redirect).not.toHaveBeenCalled();
    expect(mockedIssueCode).not.toHaveBeenCalled();
  });

  it('will not accept a consent token minted for a different request', async () => {
    // Bound to the code challenge, so it cannot be replayed onto another
    // authorization the user never saw.
    const req = await decisionReq({ code_challenge: 'a-different-challenge' });

    await expect(authorizeDecision(req, mockRes())).rejects.toMatchObject({
      name: 'BadRequestError'
    });
  });

  it('refuses a redirect_uri the client never registered', async () => {
    await expect(
      authorizeDecision(await decisionReq({ redirect_uri: 'https://evil.example/cb' }), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('token — authorization_code', () => {
  const codeBody = {
    grant_type: 'authorization_code',
    code: 'the-code',
    redirect_uri: REDIRECT,
    client_id: 'client-1',
    code_verifier: VERIFIER
  };

  const granted = {
    userId: 'u1',
    userEmail: 'u1@example.com',
    userName: 'Tester',
    resource: RESOURCE,
    scopes: ['relationship:read'],
    tenants: ['personal', 'g1'],
    defaultTenant: 'g1',
    tenantNames: { personal: 'My own data', g1: 'Irja & Tom' }
  };

  it('exchanges a code for an access and refresh token', async () => {
    mockedRedeemCode.mockResolvedValue({ ok: true, code: granted });
    mockedIssueRefresh.mockResolvedValue({ token: 'refresh-1' });
    const res = mockRes();

    await token({ body: codeBody } as Request, res);

    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'relationship:read',
      refresh_token: 'refresh-1'
    });
  });

  it('mints against what was consented to, not what the exchange asks for', async () => {
    mockedRedeemCode.mockResolvedValue({ ok: true, code: granted });
    mockedIssueRefresh.mockResolvedValue({ token: 'r' });

    await token({ body: codeBody } as Request, mockRes());

    expect(mockedIssueRefresh.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      scopes: ['relationship:read'],
      tenants: ['personal', 'g1'],
      defaultTenant: 'g1'
    });
  });

  it('returns invalid_grant for a rejected code, in the shape clients parse', async () => {
    mockedRedeemCode.mockResolvedValue({ ok: false, rejection: 'pkce-failed' });
    const res = mockRes();

    await token({ body: codeBody } as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('invalid_grant');
  });

  it.each([['code'], ['redirect_uri'], ['code_verifier']])(
    'requires %s',
    async (field) => {
      const res = mockRes();
      await token({ body: { ...codeBody, [field]: undefined } } as Request, res);
      expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('invalid_request');
    }
  );
});

describe('token — refresh_token', () => {
  const refreshBody = {
    grant_type: 'refresh_token',
    client_id: 'client-1',
    refresh_token: 'refresh-1'
  };

  it('returns a new access token and the rotated refresh token', async () => {
    mockedRedeemRefresh.mockResolvedValue({
      ok: true,
      userId: 'u1',
      scopes: ['relationship:read'],
      tenants: { allowed: ['personal', 'g1'], default: 'g1' },
      tenantNames: { personal: 'My own data', g1: 'Irja & Tom' },
      resource: RESOURCE,
      rotatedToken: 'refresh-2'
    });
    const res = mockRes();

    await token({ body: refreshBody } as Request, res);

    // The presented token is dead; a client that does not store this one will
    // read as a reuse on its next refresh.
    expect((res.json as jest.Mock).mock.calls[0][0].refresh_token).toBe('refresh-2');
  });

  it('mints the refreshed token against the same tenants, never a narrower set', async () => {
    mockedRedeemRefresh.mockResolvedValue({
      ok: true,
      userId: 'u1',
      scopes: ['relationship:read'],
      tenants: { allowed: ['personal', 'g1'], default: 'g1' },
      tenantNames: {},
      resource: RESOURCE,
      rotatedToken: 'refresh-2'
    });
    const res = mockRes();

    await token({ body: refreshBody } as Request, res);

    // A connection that quietly lost a tenant every hour would look like an
    // intermittent permissions bug rather than a narrowing.
    const claims = decodeJwt((res.json as jest.Mock).mock.calls[0][0].access_token);
    expect(claims.tenants).toEqual(['personal', 'g1']);
    expect(claims.defaultTenant).toBe('g1');
  });

  it('rejects a refused refresh token', async () => {
    mockedRedeemRefresh.mockResolvedValue({ ok: false });
    const res = mockRes();

    await token({ body: refreshBody } as Request, res);

    expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('invalid_grant');
  });

  it('rejects a reused one the same way, revealing nothing about the detection', async () => {
    mockedRedeemRefresh.mockResolvedValue({ ok: false, reused: true });
    const res = mockRes();

    await token({ body: refreshBody } as Request, res);

    expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('invalid_grant');
  });

  it('requires the refresh_token', async () => {
    const res = mockRes();
    await token({ body: { grant_type: 'refresh_token', client_id: 'c' } } as Request, res);
    expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('invalid_request');
  });
});

describe('token — other grants', () => {
  it('rejects an unsupported grant_type', async () => {
    const res = mockRes();
    await token({ body: { grant_type: 'password', client_id: 'c' } } as Request, res);
    expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('unsupported_grant_type');
  });

  it('requires a client_id', async () => {
    const res = mockRes();
    await token({ body: { grant_type: 'authorization_code' } } as Request, res);
    expect((res.json as jest.Mock).mock.calls[0][0].error).toBe('invalid_client');
  });
});

describe('connections', () => {
  it('lists the caller’s own connections', async () => {
    mockedListConnections.mockResolvedValue([{ clientId: 'client-1' }]);
    const res = mockRes();

    await getConnections({ user } as Request, res);

    expect(mockedListConnections).toHaveBeenCalledWith('u1');
  });

  it('revokes one client without touching the others', async () => {
    mockedRevoke.mockResolvedValue(2);
    const res = mockRes();

    await revokeConnection({ user, params: { clientId: 'client-1' } } as unknown as Request, res);

    expect(mockedRevoke).toHaveBeenCalledWith('u1', 'client-1');
  });

  it('404s when there was no live connection to revoke', async () => {
    mockedRevoke.mockResolvedValue(0);

    await expect(
      revokeConnection({ user, params: { clientId: 'nope' } } as unknown as Request, mockRes())
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
