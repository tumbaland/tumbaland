import { clearMembershipCache, currentGroupsOf, getUserGroupIds } from './membership';
import logger from '../logging/logger';

jest.mock('../logging/logger', () => ({ __esModule: true, default: { error: jest.fn(), warn: jest.fn() } }));

const ORIGINAL_ENV = process.env;
const answer = (data: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => ({ success: ok, data }) }) as unknown as Response;

beforeEach(() => {
  clearMembershipCache();
  jest.useRealTimers();
  process.env = {
    ...ORIGINAL_ENV,
    GROUP_INTERNAL_URL: 'http://group-service:5006',
    INTERNAL_SERVICE_TOKEN: 'internal-token',
    SERVICE_NAME: 'album-service'
  };
  global.fetch = jest.fn().mockResolvedValue(answer(['g1', 'g2']));
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

it('asks group-service over the internal channel', async () => {
  await expect(getUserGroupIds('Ada@Example.com')).resolves.toEqual(['g1', 'g2']);

  expect(global.fetch).toHaveBeenCalledWith(
    'http://group-service:5006/api/groups/mine/ids?userEmail=ada%40example.com',
    expect.objectContaining({
      headers: expect.objectContaining({ 'x-internal-token': 'internal-token', 'x-service-id': 'album-service' })
    })
  );
});

it('answers from the cache for 30 seconds, then asks again', async () => {
  jest.useFakeTimers();

  await getUserGroupIds('ada@example.com');
  await getUserGroupIds('ADA@example.com');
  expect(global.fetch).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(30_001);
  await getUserGroupIds('ada@example.com');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it('shares one request between callers asking at the same time', async () => {
  await Promise.all([getUserGroupIds('ada@example.com'), getUserGroupIds('ada@example.com')]);

  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('keeps the last known membership while group-service is unreachable', async () => {
  jest.useFakeTimers();
  await getUserGroupIds('ada@example.com');
  jest.advanceTimersByTime(30_001);
  (global.fetch as jest.Mock).mockRejectedValue(new Error('connect ECONNREFUSED'));

  await expect(getUserGroupIds('ada@example.com')).resolves.toEqual(['g1', 'g2']);
  expect(logger.warn).toHaveBeenCalled();
});

it('grants no groups when it has never been able to ask', async () => {
  (global.fetch as jest.Mock).mockResolvedValue(answer(null, false, 503));

  await expect(getUserGroupIds('ada@example.com')).resolves.toEqual([]);
  expect(logger.error).toHaveBeenCalled();
});

it('keeps the address out of the logs, naming the person by a short hash instead', async () => {
  (global.fetch as jest.Mock).mockResolvedValue(answer(null, false, 503));

  await getUserGroupIds('ada@example.com');

  const logged = JSON.stringify((logger.error as jest.Mock).mock.calls);
  expect(logged).not.toContain('ada@example.com');
  expect(logged).toMatch(/"person":"[0-9a-f]{12}"/);
});

it('grants no groups when not configured, without calling anything', async () => {
  delete process.env.GROUP_INTERNAL_URL;
  delete process.env.GROUP_API_URL;

  await expect(getUserGroupIds('ada@example.com')).resolves.toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('never takes the groups from the token', async () => {
  (global.fetch as jest.Mock).mockResolvedValue(answer(['g2']));

  await expect(currentGroupsOf({ email: 'ada@example.com', groups: ['g1', 'g9'] })).resolves.toEqual(['g2']);
});
