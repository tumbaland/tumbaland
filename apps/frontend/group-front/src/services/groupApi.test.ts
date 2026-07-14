import { vi } from 'vitest';

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => ({
    GROUP_API_URL: 'http://localhost:4006',
    AUTH_FRONT_URL: 'http://localhost:3004'
  })
}));

import { groupApi } from './groupApi';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok, status, json: async () => body } as Response);
}

describe('groupApi onUnauthorized', () => {
  it('redirects to the auth front on a 401 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'unauthorized' })
    }) as unknown as typeof fetch;
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'https://app.example/groups' } });

    await expect(groupApi.listMyGroups()).rejects.toThrow();

    expect(window.location.href).toContain('redirect_uri=');
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});

describe('groupApi', () => {
  it('lists the user\'s groups, defaulting to an empty array', async () => {
    mockFetchOnce({ data: [{ _id: 'g1', name: 'Family' }] });
    expect(await groupApi.listMyGroups()).toEqual([{ _id: 'g1', name: 'Family' }]);

    mockFetchOnce({});
    expect(await groupApi.listMyGroups()).toEqual([]);
  });

  it('gets the user\'s group ids, defaulting to an empty array', async () => {
    mockFetchOnce({ data: ['g1', 'g2'] });
    expect(await groupApi.getMyGroupIds()).toEqual(['g1', 'g2']);

    mockFetchOnce({});
    expect(await groupApi.getMyGroupIds()).toEqual([]);
  });

  it('creates a group', async () => {
    mockFetchOnce({ data: { _id: 'g1', name: 'New Group' } });
    const result = await groupApi.createGroup('New Group');
    expect(result).toEqual({ _id: 'g1', name: 'New Group' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ name: 'New Group' }) });
  });

  it('gets a single group, URL-encoding the id', async () => {
    mockFetchOnce({ data: { _id: 'g/1', name: 'X' } });
    await groupApi.getGroup('g/1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/groups/g%2F1');
  });

  it('updates a group', async () => {
    mockFetchOnce({ data: { _id: 'g1', name: 'Renamed' } });
    const result = await groupApi.updateGroup('g1', { name: 'Renamed' });
    expect(result).toEqual({ _id: 'g1', name: 'Renamed' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'PATCH' });
  });

  it('deletes a group', async () => {
    mockFetchOnce({});
    await groupApi.deleteGroup('g1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/groups/g1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('adds a member, defaulting the role to "member"', async () => {
    mockFetchOnce({ data: { _id: 'g1' } });
    await groupApi.addMember('g1', 'a@example.com');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ email: 'a@example.com', role: 'member' });
  });

  it('adds a member with an explicit role', async () => {
    mockFetchOnce({ data: { _id: 'g1' } });
    await groupApi.addMember('g1', 'a@example.com', 'admin');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ email: 'a@example.com', role: 'admin' });
  });

  it('updates a member role, URL-encoding the email', async () => {
    mockFetchOnce({ data: { _id: 'g1' } });
    await groupApi.updateMemberRole('g1', 'a b@example.com', 'admin');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/members/a%20b%40example.com');
    expect(init).toMatchObject({ method: 'PATCH' });
  });

  it('removes a member', async () => {
    mockFetchOnce({ data: { _id: 'g1' } });
    const result = await groupApi.removeMember('g1', 'a@example.com');
    expect(result).toEqual({ _id: 'g1' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'DELETE' });
  });
});
