const ORIGINAL_ENV = process.env;

import {
  generateKey,
  parseKey,
  looksLikeApiKey,
  secretMatches,
  encryptSecret,
  decryptSecret,
  displayPrefix,
  sha256,
  resetEncryptionKeyCache
} from './crypto';

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, API_KEY_ENCRYPTION_SECRET: 'test-encryption-secret' };
  resetEncryptionKeyCache();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  resetEncryptionKeyCache();
});

describe('generateKey', () => {
  it('produces a prefixed token whose parts round-trip through parseKey', () => {
    const { token, id, hash } = generateKey();
    const parsed = parseKey(token);

    expect(token.startsWith('tmb_live_')).toBe(true);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(id);
    expect(sha256(parsed!.secret)).toBe(hash);
  });

  it('never repeats a key', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateKey().token));
    expect(tokens.size).toBe(50);
  });

  it('does not store the secret in recoverable form in the hash', () => {
    const { token, hash } = generateKey();
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parseKey', () => {
  it.each([
    ['a non-string', 12345],
    ['an empty string', ''],
    ['a foreign prefix', 'sk_live_abcdef123456_secretsecretsecret'],
    ['too few parts', 'tmb_live_abcdef123456'],
    ['a missing secret', 'tmb_live_abcdef123456_'],
    ['a non-hex id', 'tmb_live_ZZZZZZZZZZZZ_secretsecretsecret'],
    ['a short id', 'tmb_live_abc_secretsecretsecret'],
    ['a truncated secret', 'tmb_live_abcdef123456_short']
  ])('rejects %s', (_label, token) => {
    expect(parseKey(token)).toBeNull();
  });

  it('accepts a secret containing underscores, which base64url produces', () => {
    // The alphabet is A-Za-z0-9-_, so roughly a third of real keys carry an
    // underscore in the secret. Splitting the token on '_' rejected those.
    expect(parseKey('tmb_live_abcdef123456_aa_bb_cc-dd_eeffgghhiijj')).toEqual({
      id: 'abcdef123456',
      secret: 'aa_bb_cc-dd_eeffgghhiijj'
    });
  });

  it('round-trips every generated key, underscores and all', () => {
    for (let i = 0; i < 200; i++) {
      const { token, id } = generateKey();
      expect(parseKey(token)?.id).toBe(id);
    }
  });

  it('accepts a well-formed key', () => {
    expect(parseKey('tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaa')).toEqual({
      id: 'abcdef123456',
      secret: 'aaaaaaaaaaaaaaaaaaaa'
    });
  });
});

describe('looksLikeApiKey', () => {
  it('separates our keys from JWTs so the caller can skip a pointless verify', () => {
    expect(looksLikeApiKey(generateKey().token)).toBe(true);
    expect(looksLikeApiKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def')).toBe(false);
    expect(looksLikeApiKey(undefined)).toBe(false);
  });
});

describe('secretMatches', () => {
  it('accepts the right secret and rejects a wrong one', () => {
    const { token, hash } = generateKey();
    const { secret } = parseKey(token)!;

    expect(secretMatches(secret, hash)).toBe(true);
    expect(secretMatches(`${secret}x`, hash)).toBe(false);
  });

  it('returns false rather than throwing on a malformed stored hash', () => {
    // timingSafeEqual throws on a length mismatch, which would turn a corrupt
    // record into a 500 instead of a failed authentication.
    expect(secretMatches('anything', 'not-a-sha256')).toBe(false);
  });
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a token', () => {
    const { token } = generateKey();
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it('produces different ciphertext each time, so equal keys are not detectable', () => {
    const { token } = generateKey();
    const a = encryptSecret(token);
    const b = encryptSecret(token);

    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('refuses to decrypt tampered ciphertext rather than returning rubbish', () => {
    const sealed = encryptSecret(generateKey().token);
    const flipped = Buffer.from(sealed.ciphertext, 'base64');
    flipped[0] ^= 0xff;

    expect(() =>
      decryptSecret({ ...sealed, ciphertext: flipped.toString('base64') })
    ).toThrow();
  });

  it('cannot be decrypted with a different encryption secret', () => {
    const sealed = encryptSecret(generateKey().token);

    process.env.API_KEY_ENCRYPTION_SECRET = 'a-completely-different-secret';
    resetEncryptionKeyCache();

    expect(() => decryptSecret(sealed)).toThrow();
  });

  it('requires the encryption secret to be configured at all', () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    resetEncryptionKeyCache();

    expect(() => encryptSecret('tmb_live_x')).toThrow(/API_KEY_ENCRYPTION_SECRET/);
  });
});

describe('displayPrefix', () => {
  it('identifies a key without exposing enough to use it', () => {
    const { token, id } = generateKey();
    const prefix = displayPrefix(id);

    expect(prefix).toBe(`tmb_live_${id}`);
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(token.length);
  });
});
