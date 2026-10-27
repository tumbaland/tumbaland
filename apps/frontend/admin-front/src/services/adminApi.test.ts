import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const getConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({ getGlobalConfig: () => getConfig() }));

import { adminApi } from './adminApi';

const respondWith = (body: unknown, status = 200) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  }) as unknown as typeof fetch;
};

const lastUrl = (): string => vi.mocked(global.fetch).mock.calls.at(-1)![0] as string;

beforeEach(() => {
  vi.clearAllMocks();
  getConfig.mockReturnValue({
    ADMIN_API_URL: 'https://admin-api.example',
    AUTH_SERVICE_URL: 'https://auth.example',
    AUTH_FRONT_URL: 'https://auth-front.example'
  });
});

describe('reading', () => {
  it('asks admin-service for the overview and unwraps the answer', async () => {
    respondWith({ success: true, data: { accounts: { total: 4 } } });

    await expect(adminApi.overview(90)).resolves.toEqual({ accounts: { total: 4 } });

    expect(lastUrl()).toBe('https://admin-api.example/api/overview?days=90');
    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('defaults to thirty days', async () => {
    respondWith({ success: true, data: {} });
    await adminApi.overview();
    expect(lastUrl()).toBe('https://admin-api.example/api/overview?days=30');

    await adminApi.assistants();
    expect(lastUrl()).toBe('https://admin-api.example/api/assistants?days=30');
  });

  it('passes the list’s sort, page and search on, leaving out what is not set', async () => {
    respondWith({ success: true, data: { users: [] } });

    await adminApi.users({ sort: 'email', page: 2, q: 'ada' });
    expect(lastUrl()).toBe('https://admin-api.example/api/users?sort=email&page=2&q=ada');

    await adminApi.users();
    expect(lastUrl()).toBe('https://admin-api.example/api/users');
  });

  it('asks for one person, keeping an odd id from changing the path', async () => {
    respondWith({ success: true, data: { user: { id: 'a/b' } } });

    await adminApi.user('a/b');

    expect(lastUrl()).toBe('https://admin-api.example/api/users/a%2Fb');
  });

  it('asks for the deletion queue and the assistants', async () => {
    respondWith({ success: true, data: { requested: [], closed: [] } });
    await expect(adminApi.deletions()).resolves.toEqual({ requested: [], closed: [] });
    expect(lastUrl()).toBe('https://admin-api.example/api/deletions');
  });
});

describe('closing an account', () => {
  it('is auth-service’s to do, since it owns accounts', async () => {
    respondWith({ success: true, data: { id: 'u1', email: 'ada@example.com', sessionsEnded: 2, connectionsRevoked: 1, keysRevoked: 3 } });

    const result = await adminApi.confirmDeletion('u1');

    expect(lastUrl()).toBe('https://auth.example/auth/admin/users/u1/deletion/confirm');
    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(result).toMatchObject({ sessionsEnded: 2, keysRevoked: 3 });
  });

  it('can be taken back', async () => {
    respondWith({ success: true, data: {} });

    await adminApi.reopenAccount('u1');

    expect(lastUrl()).toBe('https://auth.example/auth/admin/users/u1/deletion/reopen');
    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('passes on why it was refused', async () => {
    respondWith({ success: false, message: 'This account is already closed' }, 409);

    await expect(adminApi.confirmDeletion('u1')).rejects.toMatchObject({ status: 409, message: 'This account is already closed' });
  });
});

describe('a session that has ended', () => {
  it('sends the person to sign in, and back here after', async () => {
    respondWith({ success: false, message: 'Session has ended' }, 401);
    const location = { href: 'https://shell.example/admin/users' };
    Object.defineProperty(window, 'location', { value: location, configurable: true, writable: true });

    await expect(adminApi.overview()).rejects.toMatchObject({ status: 401 });

    expect(location.href).toBe(
      `https://auth-front.example?redirect_uri=${encodeURIComponent('https://shell.example/admin/users')}`
    );
  });

  it('has nowhere to send them without a sign-in address', async () => {
    getConfig.mockReturnValue({ ADMIN_API_URL: 'https://admin-api.example' });
    respondWith({ success: false }, 401);
    const location = { href: 'https://shell.example/admin' };
    Object.defineProperty(window, 'location', { value: location, configurable: true, writable: true });

    await expect(adminApi.overview()).rejects.toMatchObject({ status: 401 });

    expect(location.href).toBe('https://shell.example/admin');
  });

  it('copes with a missing address in the config', async () => {
    getConfig.mockReturnValue({});
    respondWith({ success: true, data: {} });

    await adminApi.overview();

    expect(lastUrl()).toBe('/api/overview?days=30');
  });
});
