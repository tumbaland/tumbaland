import { postPlanReminder } from './chatClient';

const reminder = {
  planId: 'p1',
  groupId: 'g1',
  userId: 'u1',
  title: 'Concert',
  date: '2026-10-16',
  time: '19:00',
  timeZone: 'Europe/Tallinn',
  remindAt: '2026-10-16T15:00:00.000Z'
};

const fetchMock = jest.fn();
const env = { ...process.env };
beforeEach(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  process.env = { ...env, INTERNAL_SERVICE_TOKEN: 'secret', CHAT_INTERNAL_URL: 'http://chat-service:4004/' };
});
afterAll(() => {
  process.env = env;
});

it('posts the reminder to chat-service’s internal route with the service token', async () => {
  fetchMock.mockResolvedValue({ ok: true });
  expect(await postPlanReminder(reminder)).toBe(true);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://chat-service:4004/internal/plan-reminder');
  expect(init.method).toBe('POST');
  expect(init.headers['x-internal-token']).toBe('secret');
  expect(JSON.parse(init.body)).toEqual(reminder);
});

it('says no when chat-service refuses or cannot be reached', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
  expect(await postPlanReminder(reminder)).toBe(false);
  fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
  expect(await postPlanReminder(reminder)).toBe(false);
});

it('does not try without a service token', async () => {
  delete process.env.INTERNAL_SERVICE_TOKEN;
  expect(await postPlanReminder(reminder)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('falls back to the local chat-service in development', async () => {
  delete process.env.CHAT_INTERNAL_URL;
  fetchMock.mockResolvedValue({ ok: true });
  await postPlanReminder(reminder);
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4004/internal/plan-reminder');
});
