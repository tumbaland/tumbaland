import { vi } from 'vitest';
import { getDashboard } from './dashboardService';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200, json: async () => body } as Response);
}

describe('getDashboard', () => {
  it('fetches dashboard data scoped to a group', async () => {
    mockFetchOnce({ success: true, data: { kpis: { netWorth: 100 } } });

    const result = await getDashboard('group-1');

    expect(result).toEqual({ kpis: { netWorth: 100 } });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/dashboard?groupId=group-1');
  });

  it('fetches personal dashboard data when no group is given', async () => {
    mockFetchOnce({ success: true, data: {} });
    await getDashboard();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('groupId');
  });
});
