const ORIGINAL_ENV = process.env;

jest.mock('./ApiKey', () => ({
  ApiKey: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn()
  }
}));

import { ApiKey } from './ApiKey';
import { PERSONAL_TENANT } from './types';
import {
  createApiKey,
  listApiKeys,
  revealApiKey,
  revokeApiKey,
  deleteApiKey,
  verifyApiKey
} from './service';
import { encryptSecret, generateKey, parseKey, resetEncryptionKeyCache, sha256 } from './crypto';

const mockedCreate = ApiKey.create as unknown as jest.Mock;
const mockedFind = ApiKey.find as unknown as jest.Mock;
const mockedFindOne = ApiKey.findOne as unknown as jest.Mock;
const mockedUpdateOne = ApiKey.updateOne as unknown as jest.Mock;
const mockedDeleteOne = ApiKey.deleteOne as unknown as jest.Mock;

const CREATED_AT = new Date('2026-09-01T00:00:00.000Z');

/** A stored key document, with the save()/field mutation the service relies on. */
function storedKey(over: Record<string, unknown> = {}) {
  return {
    _id: 'k1',
    userId: 'u1',
    userEmail: 'u1@example.com',
    userName: 'Tester',
    name: 'Claude',
    keyId: 'abcdef123456',
    hash: sha256('a-secret-value-long-enough'),
    sealedCiphertext: 'ct',
    sealedIv: 'iv',
    sealedTag: 'tag',
    scopes: ['relationship:read'],
    tenants: [PERSONAL_TENANT],
    defaultTenant: PERSONAL_TENANT,
    revealCount: 0,
    lastRevealedAt: undefined as Date | undefined,
    createdAt: CREATED_AT,
    lastUsedAt: undefined,
    expiresAt: undefined,
    revokedAt: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...over
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, API_KEY_ENCRYPTION_SECRET: 'test-encryption-secret' };
  resetEncryptionKeyCache();
  mockedUpdateOne.mockResolvedValue({});
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  resetEncryptionKeyCache();
});

describe('createApiKey', () => {
  beforeEach(() => mockedCreate.mockImplementation(async (doc) => ({ ...doc, _id: 'k1', createdAt: CREATED_AT })));

  const input = {
    userId: 'u1',
    userEmail: 'u1@example.com',
    userName: 'Tester',
    name: 'Claude',
    scopes: ['relationship:read' as const]
  };

  it('returns a usable token and stores only its digest', async () => {
    const { token } = await createApiKey(input);
    const [stored] = mockedCreate.mock.calls[0];

    // The plaintext must never reach the hash column — that is the whole point
    // of keeping a digest alongside the reversible copy.
    expect(stored.hash).not.toContain(token);
    expect(stored.hash).toBe(sha256(parseKey(token)!.secret));
    expect(stored.keyId).toBe(parseKey(token)!.id);
  });

  it('stores the token encrypted, recoverable only with the secret', async () => {
    const { token } = await createApiKey(input);
    const [stored] = mockedCreate.mock.calls[0];

    expect(stored.sealedCiphertext).not.toContain(token);
    expect(stored.sealedIv).toBeTruthy();
    expect(stored.sealedTag).toBeTruthy();
  });

  it('defaults a key with no stated tenants to the owner’s personal data', async () => {
    await createApiKey(input);
    expect(mockedCreate.mock.calls[0][0].tenants).toEqual([PERSONAL_TENANT]);
    expect(mockedCreate.mock.calls[0][0].defaultTenant).toBe(PERSONAL_TENANT);
  });

  it('stores every tenant a key was granted', async () => {
    await createApiKey({ ...input, tenants: [PERSONAL_TENANT, 'g1'], defaultTenant: 'g1' });

    expect(mockedCreate.mock.calls[0][0].tenants).toEqual([PERSONAL_TENANT, 'g1']);
    expect(mockedCreate.mock.calls[0][0].defaultTenant).toBe('g1');
  });

  it('refuses to store a default outside the grant', async () => {
    // A key acting by default in something it cannot reach would authenticate
    // and then fail every call that did not name a tenant explicitly.
    await createApiKey({ ...input, tenants: ['g1'], defaultTenant: 'g2' });

    expect(mockedCreate.mock.calls[0][0].defaultTenant).toBe('g1');
  });

  it('reads an empty grant as the safest non-empty one', async () => {
    await createApiKey({ ...input, tenants: [] });
    expect(mockedCreate.mock.calls[0][0].tenants).toEqual([PERSONAL_TENANT]);
  });

  it('snapshots the owner so verification needs no second query', async () => {
    await createApiKey(input);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({
      userEmail: 'u1@example.com',
      userName: 'Tester'
    });
  });

  it('never returns the secret material in the summary', async () => {
    const { summary } = await createApiKey(input);
    expect(summary).not.toHaveProperty('hash');
    expect(summary).not.toHaveProperty('sealedCiphertext');
    expect(summary.prefix).toBe(`tmb_live_${mockedCreate.mock.calls[0][0].keyId}`);
  });
});

describe('listApiKeys', () => {
  it('lists the owner’s keys newest first, carrying no secrets', async () => {
    const sort = jest.fn().mockResolvedValue([storedKey(), storedKey({ _id: 'k2', name: 'Other' })]);
    mockedFind.mockReturnValue({ sort });

    const keys = await listApiKeys('u1');

    expect(mockedFind).toHaveBeenCalledWith({ userId: 'u1' });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    for (const key of keys) {
      expect(key).not.toHaveProperty('hash');
      expect(key).not.toHaveProperty('sealedCiphertext');
      expect(JSON.stringify(key)).not.toContain('ct');
    }
  });

  it('renders absent timestamps as null rather than undefined', async () => {
    mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([storedKey()]) });
    const [key] = await listApiKeys('u1');

    expect(key.lastUsedAt).toBeNull();
    expect(key.expiresAt).toBeNull();
    expect(key.revokedAt).toBeNull();
  });
});

describe('revealApiKey', () => {
  it('decrypts the stored token for its owner', async () => {
    const { token } = generateKey();
    const sealed = encryptSecret(token);
    const key = storedKey({
      sealedCiphertext: sealed.ciphertext,
      sealedIv: sealed.iv,
      sealedTag: sealed.tag
    });
    mockedFindOne.mockResolvedValue(key);

    await expect(revealApiKey('u1', 'k1')).resolves.toBe(token);
  });

  it('scopes the lookup to the owner, so another user’s key is simply not found', async () => {
    mockedFindOne.mockResolvedValue(null);

    await expect(revealApiKey('someone-else', 'k1')).resolves.toBeNull();
    // Ownership is part of the query rather than a check afterwards — there is
    // no path where a mismatched user still reaches the decrypt.
    expect(mockedFindOne).toHaveBeenCalledWith({ _id: 'k1', userId: 'someone-else' });
  });

  it('counts and timestamps every reveal', async () => {
    const sealed = encryptSecret(generateKey().token);
    const key = storedKey({
      sealedCiphertext: sealed.ciphertext,
      sealedIv: sealed.iv,
      sealedTag: sealed.tag,
      revealCount: 2
    });
    mockedFindOne.mockResolvedValue(key);

    await revealApiKey('u1', 'k1');

    expect(key.revealCount).toBe(3);
    expect(key.lastRevealedAt).toBeInstanceOf(Date);
    expect(key.save).toHaveBeenCalled();
  });

  it('still reveals a revoked key, so the owner can see what they turned off', async () => {
    const { token } = generateKey();
    const sealed = encryptSecret(token);
    mockedFindOne.mockResolvedValue(
      storedKey({
        sealedCiphertext: sealed.ciphertext,
        sealedIv: sealed.iv,
        sealedTag: sealed.tag,
        revokedAt: new Date()
      })
    );

    await expect(revealApiKey('u1', 'k1')).resolves.toBe(token);
  });
});

describe('revokeApiKey', () => {
  it('stamps the key revoked', async () => {
    const key = storedKey();
    mockedFindOne.mockResolvedValue(key);

    const summary = await revokeApiKey('u1', 'k1');

    expect(key.revokedAt).toBeInstanceOf(Date);
    expect(key.save).toHaveBeenCalled();
    expect(summary?.revokedAt).not.toBeNull();
  });

  it('leaves an already-revoked key’s original timestamp alone', async () => {
    const revokedAt = new Date('2026-01-01T00:00:00.000Z');
    const key = storedKey({ revokedAt });
    mockedFindOne.mockResolvedValue(key);

    await revokeApiKey('u1', 'k1');

    expect(key.revokedAt).toBe(revokedAt);
    expect(key.save).not.toHaveBeenCalled();
  });

  it('returns null for a key that is not the caller’s', async () => {
    mockedFindOne.mockResolvedValue(null);
    await expect(revokeApiKey('u2', 'k1')).resolves.toBeNull();
  });
});

describe('deleteApiKey', () => {
  it('deletes only within the owner’s keys', async () => {
    mockedDeleteOne.mockResolvedValue({ deletedCount: 1 });

    await expect(deleteApiKey('u1', 'k1')).resolves.toBe(true);
    expect(mockedDeleteOne).toHaveBeenCalledWith({ _id: 'k1', userId: 'u1' });
  });

  it('reports false when nothing matched', async () => {
    mockedDeleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(deleteApiKey('u2', 'k1')).resolves.toBe(false);
  });
});

describe('verifyApiKey', () => {
  /** A stored record that will actually accept `token`. */
  const acceptingKey = (token: string, over: Record<string, unknown> = {}) =>
    storedKey({
      keyId: parseKey(token)!.id,
      hash: sha256(parseKey(token)!.secret),
      ...over
    });

  it('rejects a malformed token without touching the database', async () => {
    await expect(verifyApiKey('not-a-key')).resolves.toEqual({ ok: false, rejection: 'malformed' });
    expect(mockedFindOne).not.toHaveBeenCalled();
  });

  it('rejects a token for a key that does not exist', async () => {
    mockedFindOne.mockResolvedValue(null);
    const { token } = generateKey();

    await expect(verifyApiKey(token)).resolves.toEqual({ ok: false, rejection: 'unknown' });
  });

  it('rejects a revoked key', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(acceptingKey(token, { revokedAt: new Date() }));

    await expect(verifyApiKey(token)).resolves.toEqual({ ok: false, rejection: 'revoked' });
  });

  it('rejects a key whose expiry has passed', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(acceptingKey(token, { expiresAt: new Date(Date.now() - 1000) }));

    await expect(verifyApiKey(token)).resolves.toEqual({ ok: false, rejection: 'expired' });
  });

  it('accepts a key whose expiry is still ahead', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(acceptingKey(token, { expiresAt: new Date(Date.now() + 60_000) }));

    await expect(verifyApiKey(token)).resolves.toMatchObject({ ok: true });
  });

  it('rejects a right-shaped token whose secret is wrong', async () => {
    const { token } = generateKey();
    const other = generateKey();
    // Same public id, a different secret's digest — the id half is not a credential.
    mockedFindOne.mockResolvedValue(
      storedKey({ keyId: parseKey(token)!.id, hash: sha256(parseKey(other.token)!.secret) })
    );

    await expect(verifyApiKey(token)).resolves.toEqual({ ok: false, rejection: 'bad-secret' });
  });

  it('looks a key up by its public id alone', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(acceptingKey(token));

    await verifyApiKey(token);

    expect(mockedFindOne).toHaveBeenCalledWith({ keyId: parseKey(token)!.id });
  });

  it('returns the identity, scopes and tenants a valid key carries', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(
      acceptingKey(token, {
        scopes: ['relationship:read', 'album:write'],
        tenants: [PERSONAL_TENANT, 'g1'],
        defaultTenant: 'g1'
      })
    );

    await expect(verifyApiKey(token)).resolves.toEqual({
      ok: true,
      userId: 'u1',
      userEmail: 'u1@example.com',
      userName: 'Tester',
      keyId: 'k1',
      scopes: ['relationship:read', 'album:write'],
      // The key's own name, so an audit trail reads "Claude" and not "k1".
      label: 'Claude',
      tenants: { allowed: [PERSONAL_TENANT, 'g1'], default: 'g1' }
    });
  });

  it('reads a key issued before tenants were a set', async () => {
    // Keys stored under the single-tenant model carry `groupId` and no array.
    // Without this fallback every connected assistant would break at once on
    // the deploy that introduced the set.
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(
      acceptingKey(token, { tenants: undefined, defaultTenant: undefined, groupId: 'g1' })
    );

    await expect(verifyApiKey(token)).resolves.toMatchObject({
      tenants: { allowed: ['g1'], default: 'g1' }
    });
  });

  it('reads an old personal key as the personal tenant, not as no tenant', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(
      acceptingKey(token, { tenants: undefined, defaultTenant: undefined, groupId: null })
    );

    await expect(verifyApiKey(token)).resolves.toMatchObject({
      tenants: { allowed: [PERSONAL_TENANT], default: PERSONAL_TENANT }
    });
  });

  it('records that the key was used', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(acceptingKey(token));

    await verifyApiKey(token);

    expect(mockedUpdateOne).toHaveBeenCalledWith(
      { _id: 'k1' },
      { $set: { lastUsedAt: expect.any(Date) } }
    );
  });

  it('still authenticates when recording the usage timestamp fails', async () => {
    const { token } = generateKey();
    mockedFindOne.mockResolvedValue(acceptingKey(token));
    mockedUpdateOne.mockRejectedValue(new Error('write concern failed'));

    // The timestamp is a convenience for the listing UI; losing it must never
    // cost an otherwise valid request.
    await expect(verifyApiKey(token)).resolves.toMatchObject({ ok: true });
  });
});
