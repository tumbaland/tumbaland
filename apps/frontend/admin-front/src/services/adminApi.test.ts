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
    AUTH_FRONT_URL: 'https://auth-front.example',
    CHAT_API_URL: 'https://chat.example',
    PAYMENT_API_URL: 'https://payment.example'
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

describe('Claude in the chats', () => {
  const calls = () => vi.mocked(global.fetch).mock.calls.map(([url, init]) => ({ url: url as string, ...(init as RequestInit) }));

  it('reads and changes the key through chat-service, and removes it', async () => {
    respondWith({ success: true, data: { configured: true } });

    await expect(adminApi.claudeKey()).resolves.toEqual({ configured: true });
    await adminApi.saveClaudeKey({ expiresOn: '2027-03-01' });
    await adminApi.checkClaudeKey();
    await adminApi.removeClaudeKey();

    const [read, save, check, remove] = calls();
    expect(check).toMatchObject({ url: 'https://chat.example/api/chat/admin/assistant-key/check', method: 'POST' });
    expect(read).toMatchObject({ url: 'https://chat.example/api/chat/admin/assistant-key', method: 'GET' });
    expect(save).toMatchObject({ url: 'https://chat.example/api/chat/admin/assistant-key', method: 'PUT', body: JSON.stringify({ expiresOn: '2027-03-01' }) });
    expect(remove).toMatchObject({ url: 'https://chat.example/api/chat/admin/assistant-key', method: 'DELETE' });
  });

  it('asks for a month of use', async () => {
    respondWith({ success: true, data: { month: '2026-10' } });
    await adminApi.claudeUsage('2026-10');
    expect(lastUrl()).toBe('https://chat.example/api/chat/admin/assistant-usage?month=2026-10');
  });

  it('gives a person an allowance with no override yet, in units', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'No override for that user' }), text: async () => '{"message":"No override for that user"}' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }), text: async () => '{"success":true}' });
    global.fetch = fetchMock as unknown as typeof fetch;

    await adminApi.setAllowance('Tom@Example.com', 25_000, 'Trip', '2026-12-01');

    expect(fetchMock.mock.calls[0]![0]).toBe('https://payment.example/api/overrides/Tom%40Example.com');
    const [url, init] = fetchMock.mock.calls[1]! as [string, RequestInit];
    expect(url).toBe('https://payment.example/api/overrides/Tom%40Example.com');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ meters: { assistantSpend: 25_000 }, reason: 'Trip', expiresAt: '2026-12-01' });
  });

  it('keeps what an override already grants, and changes only the allowance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ override: { meters: { storageBytes: 100, assistantSpend: 1 }, features: { cleanExport: true }, retentionDays: 400 } }),
        text: async () => ''
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });
    global.fetch = fetchMock as unknown as typeof fetch;

    await adminApi.setAllowance('tom@example.com', -1, 'Family');

    expect(JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string)).toEqual({
      meters: { storageBytes: 100, assistantSpend: -1 },
      features: { cleanExport: true },
      retentionDays: 400,
      reason: 'Family'
    });
  });

  it('does not overwrite an override it could not read', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'boom' }), text: async () => '{"message":"boom"}' });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(adminApi.setAllowance('tom@example.com', 100, 'x')).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
