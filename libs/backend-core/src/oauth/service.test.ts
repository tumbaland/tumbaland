import { createHash } from 'crypto';

jest.mock('./models', () => ({
  OAuthClient: { create: jest.fn(), findOne: jest.fn(), find: jest.fn() },
  AuthorizationCode: { create: jest.fn(), findOneAndUpdate: jest.fn(), exists: jest.fn() },
  RefreshToken: { create: jest.fn(), findOne: jest.fn(), find: jest.fn(), updateMany: jest.fn() }
}));

import { AuthorizationCode, OAuthClient, RefreshToken } from './models';
import {
  registerClient,
  isRegisteredRedirect,
  issueAuthorizationCode,
  redeemAuthorizationCode,
  issueRefreshToken,
  redeemRefreshToken,
  revokeRefreshTokensForUser
} from './service';

const mockedCodeUpdate = AuthorizationCode.findOneAndUpdate as unknown as jest.Mock;
const mockedCodeExists = AuthorizationCode.exists as unknown as jest.Mock;
const mockedCodeCreate = AuthorizationCode.create as unknown as jest.Mock;
const mockedClientCreate = OAuthClient.create as unknown as jest.Mock;
const mockedRefreshCreate = RefreshToken.create as unknown as jest.Mock;
const mockedRefreshFindOne = RefreshToken.findOne as unknown as jest.Mock;
const mockedRefreshUpdateMany = RefreshToken.updateMany as unknown as jest.Mock;

const VERIFIER = 'a-code-verifier-long-enough-to-be-real';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

const storedCode = (over: Record<string, unknown> = {}) => ({
  clientId: 'client-1',
  redirectUri: 'https://claude.ai/callback',
  codeChallenge: CHALLENGE,
  expiresAt: new Date(Date.now() + 30_000),
  ...over
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedClientCreate.mockImplementation(async (doc) => doc);
  (OAuthClient.findOne as jest.Mock).mockResolvedValue(null);
  mockedCodeCreate.mockImplementation(async (doc) => doc);
  mockedRefreshCreate.mockImplementation(async (doc) => doc);
});

describe('registerClient', () => {
  it('returns the existing client when the same callback re-registers', async () => {
    // The Claude app re-registers on every connect attempt. Minting a fresh id
    // each time left three identical "Claude" rows in connected apps, only one
    // of which any given disconnect would cut off.
    (OAuthClient.findOne as jest.Mock).mockResolvedValue({
      clientId: 'tmb-client-existing',
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback']
    });

    const client = await registerClient({
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback']
    });

    expect(client.clientId).toBe('tmb-client-existing');
    expect(mockedClientCreate).not.toHaveBeenCalled();
  });

  it('matches on the exact set of callbacks, which is what identifies the app', async () => {
    (OAuthClient.findOne as jest.Mock).mockResolvedValue(null);

    await registerClient({ clientName: 'Claude', redirectUris: ['https://b/cb', 'https://a/cb'] });

    // Sorted and size-constrained: a client registering a superset is a
    // different client, and an authorization code is delivered to that URL.
    expect((OAuthClient.findOne as jest.Mock).mock.calls[0][0]).toEqual({
      redirectUris: { $size: 2, $all: ['https://a/cb', 'https://b/cb'] }
    });
  });

  it('issues a namespaced client id and keeps the redirect URIs', async () => {
    const client = await registerClient({
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/callback']
    });

    expect(client.clientId).toMatch(/^tmb-client-[0-9a-f]{32}$/);
    expect(client.redirectUris).toEqual(['https://claude.ai/callback']);
  });

  it('never issues the same id twice', async () => {
    const a = await registerClient({ clientName: 'A', redirectUris: ['https://a/cb'] });
    const b = await registerClient({ clientName: 'B', redirectUris: ['https://b/cb'] });
    expect(a.clientId).not.toBe(b.clientId);
  });
});

describe('isRegisteredRedirect', () => {
  const client = { redirectUris: ['https://claude.ai/callback'] };

  it('accepts a registered URI', () => {
    expect(isRegisteredRedirect(client, 'https://claude.ai/callback')).toBe(true);
  });

  it.each([
    ['a different host', 'https://evil.example/callback'],
    ['a path suffix', 'https://claude.ai/callback/extra'],
    ['an added query', 'https://claude.ai/callback?next=https://evil.example'],
    ['a prefix', 'https://claude.ai/call']
  ])('rejects %s — matching is exact, never prefix', (_label, uri) => {
    // Loose redirect matching is the classic way an authorization code gets
    // delivered somewhere the client never controlled.
    expect(isRegisteredRedirect(client, uri)).toBe(false);
  });
});

describe('issueAuthorizationCode', () => {
  it('stores what was consented to, and expires within a minute', async () => {
    const before = Date.now();
    await issueAuthorizationCode({
      clientId: 'client-1',
      userId: 'u1',
      userEmail: 'u1@example.com',
      userName: 'Tester',
      redirectUri: 'https://claude.ai/callback',
      scopes: ['relationship:read'],
      groupId: 'g1',
      resource: 'https://mcp.tumbaland.eu',
      codeChallenge: CHALLENGE
    });

    const [doc] = mockedCodeCreate.mock.calls[0];
    expect(doc).toMatchObject({ userId: 'u1', groupId: 'g1', scopes: ['relationship:read'] });
    expect(doc.expiresAt.getTime() - before).toBeLessThanOrEqual(60_000);
  });
});

describe('redeemAuthorizationCode', () => {
  it('accepts a correct exchange', async () => {
    mockedCodeUpdate.mockResolvedValue(storedCode());

    const result = await redeemAuthorizationCode(
      'code',
      'client-1',
      'https://claude.ai/callback',
      VERIFIER
    );

    expect(result.ok).toBe(true);
  });

  it('marks the code used in the same operation that reads it', async () => {
    mockedCodeUpdate.mockResolvedValue(storedCode());

    await redeemAuthorizationCode('code', 'client-1', 'https://claude.ai/callback', VERIFIER);

    // Atomic: two simultaneous exchanges cannot both win, which a
    // read-then-check would allow.
    expect(mockedCodeUpdate).toHaveBeenCalledWith(
      { code: 'code', usedAt: { $exists: false } },
      { $set: { usedAt: expect.any(Date) } },
      { new: true }
    );
  });

  it('refuses a code that has already been exchanged', async () => {
    mockedCodeUpdate.mockResolvedValue(null);
    mockedCodeExists.mockResolvedValue(true);

    await expect(
      redeemAuthorizationCode('code', 'client-1', 'https://claude.ai/callback', VERIFIER)
    ).resolves.toEqual({ ok: false, rejection: 'already-used' });
  });

  it('refuses a code that never existed', async () => {
    mockedCodeUpdate.mockResolvedValue(null);
    mockedCodeExists.mockResolvedValue(false);

    await expect(
      redeemAuthorizationCode('code', 'client-1', 'https://claude.ai/callback', VERIFIER)
    ).resolves.toEqual({ ok: false, rejection: 'unknown' });
  });

  it('refuses the wrong PKCE verifier', async () => {
    // Without this, an intercepted code could be exchanged by whoever stole it.
    mockedCodeUpdate.mockResolvedValue(storedCode());

    await expect(
      redeemAuthorizationCode('code', 'client-1', 'https://claude.ai/callback', 'wrong-verifier')
    ).resolves.toEqual({ ok: false, rejection: 'pkce-failed' });
  });

  it('refuses a different client redeeming the code', async () => {
    mockedCodeUpdate.mockResolvedValue(storedCode());

    await expect(
      redeemAuthorizationCode('code', 'other-client', 'https://claude.ai/callback', VERIFIER)
    ).resolves.toEqual({ ok: false, rejection: 'client-mismatch' });
  });

  it('refuses a redirect URI that differs from the one authorized', async () => {
    mockedCodeUpdate.mockResolvedValue(storedCode());

    await expect(
      redeemAuthorizationCode('code', 'client-1', 'https://evil.example/cb', VERIFIER)
    ).resolves.toEqual({ ok: false, rejection: 'redirect-mismatch' });
  });

  it('refuses an expired code', async () => {
    mockedCodeUpdate.mockResolvedValue(storedCode({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(
      redeemAuthorizationCode('code', 'client-1', 'https://claude.ai/callback', VERIFIER)
    ).resolves.toEqual({ ok: false, rejection: 'expired' });
  });
});

describe('issueRefreshToken', () => {
  it('retires any grant the same client already held for this user', async () => {
    // Reconnecting is a re-authorization, not a second connection: two live
    // grants would leave stale scopes beside the new ones and a disconnect
    // that only cut one of them.
    mockedRefreshUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await issueRefreshToken({
      clientId: 'client-1',
      userId: 'u1',
      scopes: ['relationship:read'],
      groupId: null,
      resource: 'https://mcp.tumbaland.eu'
    });

    expect(mockedRefreshUpdateMany).toHaveBeenCalledWith(
      { userId: 'u1', clientId: 'client-1', revokedAt: { $exists: false } },
      { $set: { revokedAt: expect.any(Date) } }
    );
    expect(mockedRefreshCreate).toHaveBeenCalled();
  });
});

describe('refresh token rotation', () => {
  it('retires the presented token and issues a replacement', async () => {
    const record = {
      userId: 'u1',
      scopes: ['relationship:read'],
      groupId: null,
      resource: 'https://mcp.tumbaland.eu',
      grantedAt: new Date('2026-03-01T00:00:00.000Z'),
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      save: jest.fn()
    } as Record<string, unknown>;
    mockedRefreshFindOne.mockResolvedValue(record);

    const result = await redeemRefreshToken('old-token', 'client-1');

    // The old one is dead the moment it is used: a stolen copy stops working as
    // soon as the honest client refreshes.
    expect(record.revokedAt).toBeInstanceOf(Date);
    expect(result.rotatedToken).toBeTruthy();
    expect(result.rotatedToken).not.toBe('old-token');
  });

  it('carries the original grant date onto the replacement', async () => {
    const grantedAt = new Date('2026-03-01T00:00:00.000Z');
    mockedRefreshFindOne.mockResolvedValue({
      userId: 'u1',
      scopes: [],
      groupId: null,
      resource: 'r',
      grantedAt,
      save: jest.fn()
    });

    await redeemRefreshToken('old-token', 'client-1');

    // Otherwise the UI would say the user connected an hour ago when they
    // connected in March.
    expect(mockedRefreshCreate.mock.calls[0][0].grantedAt).toBe(grantedAt);
  });

  it('treats reuse of a retired token as a compromise and cuts the whole grant', async () => {
    // Honest client and thief now both hold tokens from one grant and there is
    // no way to tell which just called, so everything goes.
    mockedRefreshFindOne.mockResolvedValue({
      userId: 'u1',
      revokedAt: new Date(),
      scopes: [],
      groupId: null,
      resource: 'r',
      save: jest.fn()
    });
    mockedRefreshUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await redeemRefreshToken('retired-token', 'client-1');

    expect(result).toMatchObject({ ok: false, reused: true });
    expect(mockedRefreshUpdateMany).toHaveBeenCalledWith(
      { userId: 'u1', clientId: 'client-1', revokedAt: { $exists: false } },
      { $set: { revokedAt: expect.any(Date) } }
    );
  });

  it('does not report an unknown token as reuse', async () => {
    mockedRefreshFindOne.mockResolvedValue(null);
    await expect(redeemRefreshToken('nope', 'client-1')).resolves.toEqual({ ok: false });
    expect(mockedRefreshUpdateMany).not.toHaveBeenCalled();
  });
});

describe('refresh tokens', () => {
  it('stores only a digest, never the token itself', async () => {
    const { token } = await issueRefreshToken({
      clientId: 'client-1',
      userId: 'u1',
      scopes: ['relationship:read'],
      groupId: null,
      resource: 'https://mcp.tumbaland.eu'
    });

    const [doc] = mockedRefreshCreate.mock.calls[0];
    expect(doc.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(doc)).not.toContain(token);
  });

  it('looks a token up by digest and returns what it may do', async () => {
    mockedRefreshFindOne.mockResolvedValue({
      userId: 'u1',
      scopes: ['relationship:read'],
      groupId: 'g1',
      resource: 'https://mcp.tumbaland.eu',
      grantedAt: new Date(),
      save: jest.fn()
    });

    await expect(redeemRefreshToken('tok', 'client-1')).resolves.toMatchObject({
      ok: true,
      userId: 'u1',
      groupId: 'g1'
    });
  });

  it('refuses a revoked token, which is how an assistant is cut off', async () => {
    mockedRefreshFindOne.mockResolvedValue({
      userId: 'u1',
      revokedAt: new Date(),
      scopes: [],
      groupId: null,
      resource: 'r',
      save: jest.fn()
    });
    mockedRefreshUpdateMany.mockResolvedValue({ modifiedCount: 0 });

    await expect(redeemRefreshToken('tok', 'client-1')).resolves.toMatchObject({ ok: false });
  });

  it('refuses an unknown token', async () => {
    mockedRefreshFindOne.mockResolvedValue(null);
    await expect(redeemRefreshToken('tok', 'client-1')).resolves.toEqual({ ok: false });
  });

  it('revokes only tokens that are still live', async () => {
    mockedRefreshUpdateMany.mockResolvedValue({ modifiedCount: 2 });

    await revokeRefreshTokensForUser('u1');

    expect(mockedRefreshUpdateMany).toHaveBeenCalledWith(
      { userId: 'u1', revokedAt: { $exists: false } },
      { $set: { revokedAt: expect.any(Date) } }
    );
  });

  it('can cut off one assistant without touching the others', async () => {
    mockedRefreshUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await revokeRefreshTokensForUser('u1', 'client-1');

    expect(mockedRefreshUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1' }),
      expect.anything()
    );
  });
});
