import { vi } from 'vite-plus/test';

vi.mock('./accountApi', () => ({
  accountApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

import { accountApi } from './accountApi';
import { apiKeyService, API_KEY_SCOPES } from './apiKeyService';

const mocked = accountApi as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const summary = {
  id: 'k1',
  name: 'Claude',
  prefix: 'tmb_live_abcdef123456',
  scopes: ['relationship:read'],
  tenants: ['personal'],
  defaultTenant: 'personal',
  createdAt: '2026-09-01T00:00:00.000Z',
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null
};

beforeEach(() => vi.clearAllMocks());

describe('API_KEY_SCOPES', () => {
  it('pairs every scope with wording a person can act on', () => {
    for (const scope of API_KEY_SCOPES) {
      expect(scope.value).toMatch(/^[a-z]+:(read|write)$/);
      expect(scope.label.length).toBeGreaterThan(0);
    }
  });

  it('offers a read and a write for each area, and no duplicates', () => {
    const values = API_KEY_SCOPES.map((scope) => scope.value);
    expect(new Set(values).size).toBe(values.length);

    for (const area of ['relationship', 'album', 'finance']) {
      expect(values).toContain(`${area}:read`);
      expect(values).toContain(`${area}:write`);
    }
  });
});

describe('list', () => {
  it('unwraps the response envelope', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [summary] });

    await expect(apiKeyService.list()).resolves.toEqual([summary]);
    expect(mocked.get).toHaveBeenCalledWith('/auth/api-keys');
  });
});

describe('create', () => {
  it('posts the request and returns the key with its token', async () => {
    mocked.post.mockResolvedValue({ success: true, data: { ...summary, token: 'tmb_live_x_y' } });
    const request = {
      name: 'Claude',
      scopes: ['relationship:read' as const],
      tenants: ['personal'],
      defaultTenant: 'personal'
    };

    const created = await apiKeyService.create(request);

    expect(mocked.post).toHaveBeenCalledWith('/auth/api-keys', request);
    expect(created.token).toBe('tmb_live_x_y');
  });
});

describe('reveal', () => {
  it('posts rather than gets, so a live credential never lands in a URL', async () => {
    mocked.post.mockResolvedValue({ success: true, data: { token: 'tmb_live_x_y' } });

    await expect(apiKeyService.reveal('k1')).resolves.toBe('tmb_live_x_y');

    expect(mocked.post).toHaveBeenCalledWith('/auth/api-keys/k1/reveal', {});
    expect(mocked.get).not.toHaveBeenCalled();
  });
});

describe('revoke', () => {
  it('posts to the revoke sub-resource and returns the updated key', async () => {
    const revoked = { ...summary, revokedAt: '2026-09-02T00:00:00.000Z' };
    mocked.post.mockResolvedValue({ success: true, data: revoked });

    await expect(apiKeyService.revoke('k1')).resolves.toEqual(revoked);
    expect(mocked.post).toHaveBeenCalledWith('/auth/api-keys/k1/revoke', {});
  });
});

describe('remove', () => {
  it('deletes the key resource', async () => {
    mocked.delete.mockResolvedValue({ success: true, data: { id: 'k1' } });

    await apiKeyService.remove('k1');

    expect(mocked.delete).toHaveBeenCalledWith('/auth/api-keys/k1');
  });
});

describe('failures', () => {
  it.each([
    ['list', () => apiKeyService.list(), 'get'],
    ['reveal', () => apiKeyService.reveal('k1'), 'post'],
    ['remove', () => apiKeyService.remove('k1'), 'delete']
  ])('lets a %s failure reach the caller rather than swallowing it', async (_label, call, method) => {
    mocked[method as 'get' | 'post' | 'delete'].mockRejectedValue(new Error('boom'));
    await expect(call()).rejects.toThrow('boom');
  });
});
