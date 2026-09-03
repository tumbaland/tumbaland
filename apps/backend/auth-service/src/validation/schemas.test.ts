import { createApiKeySchema } from './schemas';

const valid = { name: 'Claude Code', scopes: ['relationship:read'] };

describe('createApiKeySchema', () => {
  it('accepts a minimal personal key', () => {
    expect(createApiKeySchema.safeParse(valid).success).toBe(true);
  });

  it('trims the name and rejects one that is only whitespace', () => {
    expect(createApiKeySchema.parse({ ...valid, name: '  Claude  ' }).name).toBe('Claude');
    expect(createApiKeySchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('caps the name so a listing stays readable', () => {
    expect(createApiKeySchema.safeParse({ ...valid, name: 'x'.repeat(61) }).success).toBe(false);
    expect(createApiKeySchema.safeParse({ ...valid, name: 'x'.repeat(60) }).success).toBe(true);
  });

  it('requires at least one scope — a key that can do nothing is a mistake', () => {
    expect(createApiKeySchema.safeParse({ ...valid, scopes: [] }).success).toBe(false);
  });

  it('rejects a scope that is not one of ours', () => {
    // Otherwise a typo would create a key that silently authorises nothing, or
    // a forged scope would be stored and later compared against.
    expect(createApiKeySchema.safeParse({ ...valid, scopes: ['admin:everything'] }).success).toBe(false);
    expect(createApiKeySchema.safeParse({ ...valid, scopes: ['relationship:delete'] }).success).toBe(false);
  });

  it('accepts every scope the system defines at once', () => {
    const all = [
      'relationship:read', 'relationship:write',
      'album:read', 'album:write',
      'finance:read', 'finance:write'
    ];
    expect(createApiKeySchema.safeParse({ ...valid, scopes: all }).success).toBe(true);
  });

  it.each([
    ['omitted', {}],
    ['null', { groupId: null }],
    ['an empty string, as an unset Select submits', { groupId: '' }]
  ])('treats a groupId that is %s as personal scope', (_label, over) => {
    expect(createApiKeySchema.safeParse({ ...valid, ...over }).success).toBe(true);
  });

  it('accepts a group id', () => {
    expect(createApiKeySchema.parse({ ...valid, groupId: 'g1' }).groupId).toBe('g1');
  });

  it('rejects an expiry in the past, which would create a dead key', () => {
    expect(createApiKeySchema.safeParse({ ...valid, expiresAt: '2020-01-01T00:00:00.000Z' }).success).toBe(false);
  });

  it('accepts an expiry in the future and coerces it to a Date', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const parsed = createApiKeySchema.parse({ ...valid, expiresAt: future });
    expect(parsed.expiresAt).toBeInstanceOf(Date);
  });

  it('accepts no expiry at all', () => {
    expect(createApiKeySchema.safeParse({ ...valid, expiresAt: null }).success).toBe(true);
  });
});
