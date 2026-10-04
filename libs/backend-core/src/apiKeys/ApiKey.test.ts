import { ApiKey, API_KEY_SECRET_FIELDS } from './ApiKey';

/** The fields the schema insists on, so each test only varies what it is about. */
const complete = {
  userId: 'u1',
  userEmail: 'u1@example.com',
  userName: 'Tester',
  name: 'Claude Code',
  keyId: 'abcdef123456',
  hash: 'a'.repeat(64),
  sealedCiphertext: 'ct',
  sealedIv: 'iv',
  sealedTag: 'tag'
};

describe('required fields', () => {
  it('accepts a complete document', () => {
    expect(new ApiKey(complete).validateSync()).toBeUndefined();
  });

  it.each(['userId', 'userEmail', 'name', 'keyId', 'hash', 'sealedCiphertext', 'sealedIv', 'sealedTag'])(
    'refuses a document with no %s',
    (field) => {
      const doc = new ApiKey({ ...complete, [field]: undefined });
      expect(doc.validateSync()?.errors[field]).toBeDefined();
    }
  );

  it('will not store a key without the material needed to verify it', () => {
    // A record missing its digest could never authenticate anything, and one
    // missing the sealed copy could never be revealed — both are corruption,
    // not a valid state.
    const doc = new ApiKey({ ...complete, hash: undefined, sealedCiphertext: undefined });
    const err = doc.validateSync();

    expect(err?.errors.hash).toBeDefined();
    expect(err?.errors.sealedCiphertext).toBeDefined();
  });
});

describe('defaults', () => {
  it('treats an unpinned key as personal rather than as unset', () => {
    // `null` and "nobody set this" must not be distinguishable downstream: the
    // middleware reads a null groupId as the owner's personal scope.
    expect(new ApiKey(complete).groupId).toBeNull();
  });

  it('starts with no scopes, so a key grants nothing until asked', () => {
    expect(new ApiKey(complete).scopes).toEqual([]);
  });

  it('starts the reveal counter at zero', () => {
    expect(new ApiKey(complete).revealCount).toBe(0);
  });

  it('leaves the lifecycle timestamps unset', () => {
    const doc = new ApiKey(complete);

    expect(doc.lastUsedAt).toBeUndefined();
    expect(doc.expiresAt).toBeUndefined();
    expect(doc.revokedAt).toBeUndefined();
    expect(doc.lastRevealedAt).toBeUndefined();
  });
});

describe('name', () => {
  it('trims surrounding whitespace', () => {
    expect(new ApiKey({ ...complete, name: '  Claude  ' }).name).toBe('Claude');
  });

  it('caps the length so a listing stays readable', () => {
    const doc = new ApiKey({ ...complete, name: 'x'.repeat(61) });
    expect(doc.validateSync()?.errors.name).toBeDefined();
  });

  it('accepts a name at the cap', () => {
    const doc = new ApiKey({ ...complete, name: 'x'.repeat(60) });
    expect(doc.validateSync()?.errors.name).toBeUndefined();
  });
});

describe('indexes', () => {
  const indexes = ApiKey.schema.indexes().map(([fields]) => fields);

  it('indexes keyId, which every verification looks a key up by', () => {
    const path = ApiKey.schema.path('keyId') as unknown as { options: Record<string, unknown> };
    expect(path.options.index).toBe(true);
    expect(path.options.unique).toBe(true);
  });

  it('indexes a user’s keys newest first, matching how the listing reads them', () => {
    expect(indexes).toContainEqual({ userId: 1, createdAt: -1 });
  });
});

describe('collection', () => {
  it('lives in api_keys', () => {
    // Named explicitly rather than pluralised by Mongoose, so the collection a
    // migration or a manual query targets is not a guess.
    expect(ApiKey.collection.collectionName).toBe('api_keys');
  });
});

describe('model registration', () => {
  it('reuses the compiled model instead of redefining it', () => {
    // backend-core is imported by every service, and some import it more than
    // once through different paths; recompiling would throw OverwriteModelError.
    // oxlint-disable-next-line @typescript-eslint/no-require-imports
    const again = require('./ApiKey').ApiKey;
    expect(again).toBe(ApiKey);
  });
});

describe('what a key’s audit trail may carry', () => {
  /**
   * The trail is readable by the account owner and kept for a year. A snapshot
   * carrying the hash or the sealed ciphertext would copy credential material
   * into a second collection with a different lifetime — which is exactly what
   * the encryption exists to prevent.
   */
  it('redacts every field on the schema that holds a secret', () => {
    const secretish = Object.keys(ApiKey.schema.paths).filter((path) => /hash|sealed|secret/i.test(path));

    // Compared against the schema rather than a hand-written list, so a secret
    // field added later fails here instead of quietly reaching the trail.
    expect(secretish.sort()).toEqual([...API_KEY_SECRET_FIELDS].sort());
  });

  it('keeps the fields that make a row worth reading', () => {
    for (const field of ['name', 'scopes', 'tenants', 'revokedAt']) {
      expect(API_KEY_SECRET_FIELDS).not.toContain(field);
    }
  });
});
