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

  it('appends params after an existing query string with &', async () => {
    mockFetchOnce({ items: [] });
    const client = createApiClient({ baseUrl });

    await client.get('/things?sort=asc', { params: { page: 2 } });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example/things?sort=asc&page=2',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
