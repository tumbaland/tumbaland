import { signToken, verifyToken } from './hmac';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, FILE_SERVICE_HMAC_SECRET: 'test-hmac-secret' };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('signToken', () => {
  it('produces a deterministic hex digest for the same inputs', () => {
    const a = signToken('upload', 'user/album/file.jpg', 1000);
    const b = signToken('upload', 'user/album/file.jpg', 1000);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });

  it('produces different tokens for different operations, fileIds, or expiries', () => {
    const base = signToken('upload', 'a.jpg', 1000);
    expect(signToken('download', 'a.jpg', 1000)).not.toBe(base);
    expect(signToken('upload', 'b.jpg', 1000)).not.toBe(base);
    expect(signToken('upload', 'a.jpg', 2000)).not.toBe(base);
  });

  it('throws when FILE_SERVICE_HMAC_SECRET is not configured', () => {
    delete process.env.FILE_SERVICE_HMAC_SECRET;
    expect(() => signToken('upload', 'a.jpg', 1000)).toThrow('FILE_SERVICE_HMAC_SECRET env var is required');
  });
});

describe('verifyToken', () => {
  it('returns true for a valid, unexpired token', () => {
    const futureExpiry = Date.now() + 60_000;
    const token = signToken('download', 'a.jpg', futureExpiry);

    expect(verifyToken('download', 'a.jpg', futureExpiry, token)).toBe(true);
  });

  it('returns false for an expired token', () => {
    const pastExpiry = Date.now() - 1;
    const token = signToken('download', 'a.jpg', pastExpiry);

    expect(verifyToken('download', 'a.jpg', pastExpiry, token)).toBe(false);
  });

  it('returns false for a token signed for a different operation', () => {
    const futureExpiry = Date.now() + 60_000;
    const token = signToken('upload', 'a.jpg', futureExpiry);

    expect(verifyToken('download', 'a.jpg', futureExpiry, token)).toBe(false);
  });

  it('returns false for a token signed for a different fileId', () => {
    const futureExpiry = Date.now() + 60_000;
    const token = signToken('download', 'a.jpg', futureExpiry);

    expect(verifyToken('download', 'b.jpg', futureExpiry, token)).toBe(false);
  });

  it('returns false for a same-length but tampered (wrong signature) token', () => {
    const futureExpiry = Date.now() + 60_000;
    const token = signToken('download', 'a.jpg', futureExpiry);
    // Flip the last hex character — same length, different signature.
    const flipped = token.slice(0, -1) + (token.at(-1) === '0' ? '1' : '0');

    expect(verifyToken('download', 'a.jpg', futureExpiry, flipped)).toBe(false);
  });

  it('returns false (not throw) for a malformed, wrong-length token', () => {
    const futureExpiry = Date.now() + 60_000;

    // timingSafeEqual would throw RangeError on mismatched buffer lengths;
    // verifyToken checks the length itself first so a malformed token is
    // just rejected, same as any other invalid token — see auth.test.ts for
    // the middleware asserting this comes back as 403, not 500.
    expect(verifyToken('download', 'a.jpg', futureExpiry, 'not-a-real-token')).toBe(false);
  });
});
