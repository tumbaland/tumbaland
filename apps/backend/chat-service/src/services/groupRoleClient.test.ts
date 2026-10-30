import { groupManagers, isGroupManager, resetGroupRoleCache } from './groupRoleClient';

const fetchMock = jest.spyOn(global, 'fetch');
const answer = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

beforeEach(() => {
  fetchMock.mockReset();
  resetGroupRoleCache();
  process.env.GROUP_INTERNAL_URL = 'http://group-service:4003';
  process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
  process.env.SERVICE_NAME = 'chat-service';
});
afterAll(() => fetchMock.mockRestore());

describe('groupManagers', () => {
  it('asks group-service, over the internal channel, who owns or administers the group', async () => {
    fetchMock.mockResolvedValue(answer({ success: true, managers: ['Owner@Example.com', 'admin@example.com'] }));

    expect(await groupManagers('g1')).toEqual(['owner@example.com', 'admin@example.com']);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://group-service:4003/internal/groups/g1/managers',
      expect.objectContaining({ headers: { 'x-internal-token': 'internal-test-token', 'x-service-id': 'chat-service' } })
    );
  });

  it('remembers the answer for a minute', async () => {
    fetchMock.mockResolvedValue(answer({ managers: ['a@example.com'] }));
    await groupManagers('g1');
    await groupManagers('g1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await groupManagers('g2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads a group with no managers listed as having none', async () => {
    fetchMock.mockResolvedValue(answer({}));
    expect(await groupManagers('g1')).toEqual([]);
  });

  it('answers null, and remembers nothing, when group-service cannot say', async () => {
    fetchMock.mockResolvedValueOnce(answer({}, false, 404));
    expect(await groupManagers('g1')).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    expect(await groupManagers('g1')).toBeNull();
    fetchMock.mockResolvedValueOnce(answer({ managers: ['a@example.com'] }));
    expect(await groupManagers('g1')).toEqual(['a@example.com']);
  });

  it('answers null when it is not set up to ask', async () => {
    delete process.env.GROUP_INTERNAL_URL;
    delete process.env.GROUP_API_URL;
    expect(await groupManagers('g1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the public group address, like the rest of the services', async () => {
    delete process.env.GROUP_INTERNAL_URL;
    process.env.GROUP_API_URL = 'https://group.example.com';
    fetchMock.mockResolvedValue(answer({ managers: [] }));
    await groupManagers('g1');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://group.example.com/internal/groups/g1/managers');
    delete process.env.GROUP_API_URL;
  });
});

describe('isGroupManager', () => {
  it('compares emails without caring about case', async () => {
    fetchMock.mockResolvedValue(answer({ managers: ['admin@example.com'] }));
    expect(await isGroupManager('g1', 'Admin@Example.com')).toBe(true);
    expect(await isGroupManager('g1', 'member@example.com')).toBe(false);
  });

  it('is never a yes when group-service could not answer', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await isGroupManager('g1', 'admin@example.com')).toBe(false);
  });
});
