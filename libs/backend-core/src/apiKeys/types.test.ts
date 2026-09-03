import { API_KEY_SCOPES, isApiKeyScope } from './types';

describe('API_KEY_SCOPES', () => {
  it('has no duplicates', () => {
    expect(new Set(API_KEY_SCOPES).size).toBe(API_KEY_SCOPES.length);
  });

  it('offers a read and a write for every area it covers', () => {
    for (const area of ['relationship', 'album', 'finance']) {
      expect(API_KEY_SCOPES).toContain(`${area}:read`);
      expect(API_KEY_SCOPES).toContain(`${area}:write`);
    }
  });

  it('grants nothing over auth or payment, which stay a person’s to do', () => {
    // A key that could mint keys could not be revoked, and one that could change
    // a subscription has no ceiling on what it can cost.
    for (const scope of API_KEY_SCOPES) {
      expect(scope.startsWith('auth:')).toBe(false);
      expect(scope.startsWith('payment:')).toBe(false);
    }
  });
});

describe('isApiKeyScope', () => {
  it.each([...API_KEY_SCOPES])('accepts %s', (scope) => {
    expect(isApiKeyScope(scope)).toBe(true);
  });

  it.each([
    ['an invented area', 'admin:everything'],
    ['an invented verb', 'relationship:delete'],
    ['a bare area', 'relationship'],
    ['an empty string', ''],
    ['a non-string', 42],
    ['null', null],
    ['undefined', undefined]
  ])('rejects %s', (_label, value) => {
    expect(isApiKeyScope(value)).toBe(false);
  });
});
