import { createApiClient, ApiError } from './apiClient';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  });
}

describe('createApiClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  const baseUrl = () => 'https://api.example';

  it('GET sends credentials:include and resolves the JSON body', async () => {
    mockFetchOnce({ hello: 'world' });
    const client = createApiClient({ baseUrl });

    const result = await client.get('/things');

    expect(result).toEqual({ hello: 'world' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example/things',
      expect.objectContaining({ credentials: 'include', method: 'GET' })
    );
  });

  it('POST serializes the body as JSON', async () => {
    mockFetchOnce({ created: true });
    const client = createApiClient({ baseUrl });

    await client.post('/things', { name: 'a thing' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example/things',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'a thing' }) })
    );
  });

  it('throws an ApiError with the response status and parsed message on failure', async () => {
    mockFetchOnce({ message: 'not found' }, { ok: false, status: 404 });
    const client = createApiClient({ baseUrl });

    let caught: unknown;
    try {
      await client.get('/missing');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ status: 404, message: 'not found' });
  });

  it('calls onUnauthorized on a 401 unless skipAuthRedirect is set', async () => {
    const onUnauthorized = vi.fn();
    const client = createApiClient({ baseUrl, onUnauthorized });

    mockFetchOnce({ message: 'no' }, { ok: false, status: 401 });
    await expect(client.get('/secret')).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    mockFetchOnce({ message: 'no' }, { ok: false, status: 401 });
    await expect(client.get('/secret', { skipAuthRedirect: true })).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for a 204 response', async () => {
    mockFetchOnce(undefined, { status: 204 });
    const client = createApiClient({ baseUrl });

    const result = await client.delete('/things/1');

    expect(result).toBeUndefined();
  });

  it('serializes params onto the query string, omitting nullish values', async () => {
    mockFetchOnce({ items: [] });
    const client = createApiClient({ baseUrl });

    await client.get('/things', { params: { page: 2, search: 'x', groupId: undefined, archived: null } });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example/things?page=2&search=x',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('leaves the path unchanged when params has no defined values', async () => {
    mockFetchOnce({ items: [] });
    const client = createApiClient({ baseUrl });

    await client.get('/things', { params: { groupId: undefined, archived: null } });

    expect(global.fetch).toHaveBeenCalledWith('https://api.example/things', expect.objectContaining({ method: 'GET' }));
  });

  it('appends params after an existing query string with &', async () => {
    mockFetchOnce({ items: [] });
    const client = createApiClient({ baseUrl });

    await client.get('/things?sort=asc', { params: { page: 2 } });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example/things?sort=asc&page=2',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('falls back to a generic status message when a non-ok response body is not JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      }
    });
    const client = createApiClient({ baseUrl });

    let caught: unknown;
    try {
      await client.get('/things');
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ status: 500, message: 'HTTP error! status: 500', body: undefined });
  });

  it('PUT and PATCH serialize the body as JSON with the matching method', async () => {
    mockFetchOnce({ updated: true });
    mockFetchOnce({ patched: true });
    const client = createApiClient({ baseUrl });

    await client.put('/things/1', { name: 'updated' });
    await client.patch('/things/1', { name: 'patched' });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example/things/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'updated' }) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example/things/1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'patched' }) })
    );
  });

  it('POST, PUT, and PATCH send body:undefined when called with no body', async () => {
    mockFetchOnce({ ok: true });
    mockFetchOnce({ ok: true });
    mockFetchOnce({ ok: true });
    const client = createApiClient({ baseUrl });

    await client.post('/things');
    await client.put('/things/1');
    await client.patch('/things/1');

    for (const call of (global.fetch as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[1]).toMatchObject({ body: undefined });
    }
  });

  it('sends the correlation/session headers and lets caller-supplied headers override them', async () => {
    mockFetchOnce({ ok: true });
    const client = createApiClient({ baseUrl });

    await client.get('/things', { headers: { 'Content-Type': 'text/plain' } });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('text/plain');
    expect(headers.get('x-correlation-id')).toEqual(expect.any(String));
    expect(headers.get('x-session-id')).toEqual(expect.any(String));
  });

  it('keeps headers given as a Headers object or a list of pairs', async () => {
    const client = createApiClient({ baseUrl });

    mockFetchOnce({});
    await client.get('/a', { headers: new Headers({ 'x-extra': '1' }) });
    mockFetchOnce({});
    await client.get('/b', { headers: [['x-extra', '2']] });

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(new Headers(calls[0][1].headers).get('x-extra')).toBe('1');
    expect(new Headers(calls[1][1].headers).get('x-extra')).toBe('2');
  });

  it('sends JSON content type by default, but leaves it to the browser for a FormData body', async () => {
    const client = createApiClient({ baseUrl });

    mockFetchOnce({});
    await client.post('/json', { a: 1 });
    mockFetchOnce({});
    await client.request('/upload', { method: 'POST', body: new FormData() });

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(new Headers(calls[0][1].headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(calls[1][1].headers).get('Content-Type')).toBeNull();
  });
});
