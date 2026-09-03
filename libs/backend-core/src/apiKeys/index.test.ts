import * as core from '../index';
import * as apiKeys from './index';

/**
 * The package's public surface, as the services actually consume it.
 *
 * Services install this lib from npm, so an export dropped in a refactor does
 * not fail here — it fails inside a Docker build as "has no exported member X",
 * against a registry that genuinely has the code. That is a slow and confusing
 * loop, and it is entirely preventable by naming the surface once.
 */
const PUBLIC_SURFACE = [
  // middleware the services mount
  'authenticateAgent',
  'requireScope',
  'denyApiKeys',
  // key lifecycle, used by auth-service
  'createApiKey',
  'listApiKeys',
  'revealApiKey',
  'revokeApiKey',
  'deleteApiKey',
  'verifyApiKey',
  // configuration and vocabulary
  'isEncryptionConfigured',
  'API_KEY_SCOPES',
  'isApiKeyScope',
  'ApiKey',
  // helpers
  'looksLikeApiKey',
  'displayPrefix',
  'resetEncryptionKeyCache'
] as const;

describe('the apiKeys barrel', () => {
  it.each(PUBLIC_SURFACE)('exports %s', (name) => {
    expect(apiKeys).toHaveProperty(name);
    expect((apiKeys as Record<string, unknown>)[name]).toBeDefined();
  });
});

describe('the package root', () => {
  it.each(PUBLIC_SURFACE)('re-exports %s, which is how services import it', (name) => {
    expect((core as Record<string, unknown>)[name]).toBeDefined();
  });

  it('exposes the same binding through both paths', () => {
    for (const name of PUBLIC_SURFACE) {
      expect((core as Record<string, unknown>)[name]).toBe((apiKeys as Record<string, unknown>)[name]);
    }
  });

  it('still exports the session middleware the key work sits alongside', () => {
    // `authenticateToken` stays JWT-only and is what auth-service and
    // payment-service rely on to refuse keys outright.
    expect(core.authenticateToken).toBeDefined();
    expect(core.optionalAuth).toBeDefined();
  });
});

describe('the scope vocabulary', () => {
  it('is the same list the services and the UI are written against', () => {
    expect([...core.API_KEY_SCOPES]).toEqual([
      'relationship:read',
      'relationship:write',
      'album:read',
      'album:write',
      'finance:read',
      'finance:write'
    ]);
  });
});
