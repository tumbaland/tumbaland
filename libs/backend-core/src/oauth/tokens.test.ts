const ORIGINAL_ENV = process.env;

import jwt from 'jsonwebtoken';
import { PERSONAL_TENANT } from '../apiKeys/types';
import { mintAccessToken, verifyAccessToken, parseScopes } from './tokens';

const RESOURCE = 'https://mcp.tumbaland.eu';
const ISSUER = 'https://auth-api.tumbaland.eu';

const mint = (over: Partial<Parameters<typeof mintAccessToken>[0]> = {}) =>
  mintAccessToken({
    userId: 'u1',
    email: 'u1@example.com',
    name: 'Tester',
    resource: RESOURCE,
    issuer: ISSUER,
    scopes: ['relationship:read', 'relationship:write'],
    tenants: [PERSONAL_TENANT],
    defaultTenant: PERSONAL_TENANT,
    tenantNames: { [PERSONAL_TENANT]: 'My own data' },
    ...over
  });

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-jwt-secret' };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('mintAccessToken', () => {
  it('binds the token to one resource and carries the granted scopes', () => {
    const { accessToken, scope, expiresIn } = mint();
    const claims = jwt.decode(accessToken) as Record<string, unknown>;

    expect(claims.aud).toBe(RESOURCE);
    expect(claims.iss).toBe(ISSUER);
    expect(claims.sub).toBe('u1');
    expect(scope).toBe('relationship:read relationship:write');
    expect(expiresIn).toBe(3600);
  });

  it('carries the granted tenants, so a token cannot wander outside them', () => {
    const claims = jwt.decode(
      mint({ tenants: [PERSONAL_TENANT, 'g1'], defaultTenant: 'g1' }).accessToken
    ) as Record<string, unknown>;

    expect(claims.tenants).toEqual([PERSONAL_TENANT, 'g1']);
    expect(claims.defaultTenant).toBe('g1');
  });

  it('carries what each tenant is called, since nothing downstream can look it up', () => {
    const claims = jwt.decode(
      mint({ tenants: ['g1'], defaultTenant: 'g1', tenantNames: { g1: 'Irja & Tom' } }).accessToken
    ) as Record<string, unknown>;

    expect(claims.tenantNames).toEqual({ g1: 'Irja & Tom' });
  });

  it('gives every token a distinct id', () => {
    const a = jwt.decode(mint().accessToken) as Record<string, unknown>;
    const b = jwt.decode(mint().accessToken) as Record<string, unknown>;
    expect(a.jti).not.toBe(b.jti);
  });
});

describe('verifyAccessToken', () => {
  it('accepts a token minted for this resource', () => {
    const { accessToken } = mint();

    expect(verifyAccessToken(accessToken, RESOURCE)).toMatchObject({
      ok: true,
      userId: 'u1',
      email: 'u1@example.com',
      scopes: ['relationship:read', 'relationship:write'],
      tenants: { allowed: [PERSONAL_TENANT], default: PERSONAL_TENANT }
    });
  });

  it('refuses a token minted for a different resource', () => {
    // RFC 8707 audience binding: a token obtained for somewhere else must not
    // be replayable here, which is the whole point of the resource parameter.
    const { accessToken } = mint({ resource: 'https://mcp.someone-else.example' });

    expect(verifyAccessToken(accessToken, RESOURCE)).toEqual({
      ok: false,
      rejection: 'wrong-audience'
    });
  });

  it('refuses an ordinary session JWT presented as an access token', () => {
    // Same secret, same issuer — but no scopes and no tenant pin. Without the
    // type check a user's session cookie would authenticate as an assistant
    // holding every permission.
    const session = jwt.sign(
      { id: 'u1', email: 'u1@example.com', name: 'Tester', groups: ['g1'] },
      'test-jwt-secret'
    );

    expect(verifyAccessToken(session, RESOURCE)).toEqual({ ok: false, rejection: 'wrong-type' });
  });

  it('refuses a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 'u1', aud: RESOURCE, typ: 'mcp_access' }, 'not-the-secret');
    expect(verifyAccessToken(forged, RESOURCE)).toEqual({ ok: false, rejection: 'bad-signature' });
  });

  it('reports an expired token distinctly, so the client knows to refresh', () => {
    const expired = jwt.sign(
      { sub: 'u1', aud: RESOURCE, typ: 'mcp_access', scope: '' },
      'test-jwt-secret',
      { expiresIn: -10 }
    );

    expect(verifyAccessToken(expired, RESOURCE)).toEqual({ ok: false, rejection: 'expired' });
  });

  it('refuses gibberish rather than throwing', () => {
    expect(verifyAccessToken('not-a-token', RESOURCE).ok).toBe(false);
  });

  it('drops scopes it does not define, so a forged claim grants nothing', () => {
    const token = jwt.sign(
      { sub: 'u1', aud: RESOURCE, typ: 'mcp_access', scope: 'relationship:read admin:everything' },
      'test-jwt-secret'
    );

    expect(verifyAccessToken(token, RESOURCE).scopes).toEqual(['relationship:read']);
  });
});

describe('parseScopes', () => {
  it('keeps only scopes the system defines', () => {
    expect(parseScopes('relationship:read admin:all finance:write')).toEqual([
      'relationship:read',
      'finance:write'
    ]);
  });

  it.each([[undefined], [null], [42], ['']])('returns nothing for %s', (value) => {
    expect(parseScopes(value)).toEqual([]);
  });
});
