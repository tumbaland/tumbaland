import { vi } from 'vite-plus/test';
import { createPlan, deletePlan, getPlan, getPlans, logPlan, updatePlan } from './plans';

const fetchMock = () => global.fetch as ReturnType<typeof vi.fn>;
function mockFetchOnce(body: unknown) {
  fetchMock().mockResolvedValueOnce({ ok: true, status: 200, json: async () => body } as Response);
}
const lastCall = () => {
  const [url, init] = fetchMock().mock.calls[fetchMock().mock.calls.length - 1];
  return { url: String(url), init: init as RequestInit };
};

it('reads a month of plans with the filters as query params', async () => {
  mockFetchOnce({ success: true, data: [] });
  await getPlans({ groupId: 'g1', startDate: '2026-10-01', endDate: '2026-10-31', upcoming: true, limit: 5 });
  const { url } = lastCall();
  expect(url).toContain('/plans?');
  for (const part of ['groupId=g1', 'startDate=2026-10-01', 'endDate=2026-10-31', 'upcoming=true', 'limit=5']) {
    expect(url).toContain(part);
  }
});

it('reads all plans without a query string', async () => {
  mockFetchOnce({ success: true, data: [] });
  await getPlans();
  expect(lastCall().url).toMatch(/\/plans$/);
});

it('reads one plan', async () => {
  mockFetchOnce({ success: true, data: { id: 'p1' } });
  expect(await getPlan('p1')).toEqual({ id: 'p1' });
  expect(lastCall().url).toMatch(/\/plans\/p1$/);
});

it('sends the browser’s time zone with a new plan', async () => {
  mockFetchOnce({ success: true, data: { id: 'p1' } });
  await createPlan({ title: 'Concert', date: '2026-10-16', time: '19:00' });
  const { init } = lastCall();
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toMatchObject({
    title: 'Concert',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
});

it('changes, deletes and logs a plan', async () => {
  mockFetchOnce({ success: true, data: { id: 'p1' } });
  await updatePlan('p1', { title: 'Gig' });
  expect(lastCall().init.method).toBe('PATCH');

  mockFetchOnce({ success: true });
  await deletePlan('p1');
  expect(lastCall().init.method).toBe('DELETE');

  mockFetchOnce({ success: true, data: { plan: { id: 'p1' }, activityId: 'a1' } });
  expect(await logPlan('p1', 't1')).toEqual({ plan: { id: 'p1' }, activityId: 'a1' });
  expect(lastCall().url).toMatch(/\/plans\/p1\/log$/);
  expect(JSON.parse(String(lastCall().init.body))).toEqual({ typeId: 't1' });

  mockFetchOnce({ success: true, data: { plan: { id: 'p1' }, activityId: 'a1' } });
  await logPlan('p1');
  expect(JSON.parse(String(lastCall().init.body))).toEqual({});
});
