import { vi } from 'vitest';
import {
  getStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData
} from './statistics';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok, status, json: async () => body } as Response);
}

describe('getStatistics', () => {
  it('defaults timeframe to "all" and omits groupId when not given', async () => {
    mockFetchOnce({ success: true, data: { totalHours: 0 } });
    await getStatistics();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('timeframe=all');
    expect(String(url)).not.toContain('groupId');
  });

  it('passes the timeframe and groupId through', async () => {
    mockFetchOnce({ success: true, data: { totalHours: 5 } });
    const result = await getStatistics('week', 'g1');
    expect(result).toEqual({ totalHours: 5 });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('timeframe=week');
    expect(String(url)).toContain('groupId=g1');
  });

  it('wraps a thrown ApiError/Error message and logs it', async () => {
    mockFetchOnce({ message: 'Bad request' }, { ok: false, status: 400 });
    await expect(getStatistics()).rejects.toThrow('Bad request');
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('not an error');
    await expect(getStatistics()).rejects.toThrow('Failed to fetch statistics');
  });
});

describe('getMonthlyHours', () => {
  it('omits year/groupId when not given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getMonthlyHours();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('?');
  });

  it('includes year and groupId when given', async () => {
    mockFetchOnce({ success: true, data: [{ month: 'Jan', year: 2024, hours: 5, activities: 2 }] });
    const result = await getMonthlyHours(2024, 'g1');
    expect(result).toEqual([{ month: 'Jan', year: 2024, hours: 5, activities: 2 }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('year=2024');
    expect(String(url)).toContain('groupId=g1');
  });

  it('throws a wrapped error on failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    await expect(getMonthlyHours()).rejects.toThrow('down');
  });
});

describe('getMonthlyStatistics', () => {
  it('includes year and groupId when given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getMonthlyStatistics(2024, 'g1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('year=2024');
    expect(String(url)).toContain('groupId=g1');
  });

  it('throws a generic error on a non-Error rejection', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    await expect(getMonthlyStatistics()).rejects.toThrow('Failed to fetch monthly statistics');
  });
});

describe('getMonthlyActivityBreakdown', () => {
  it('includes year and groupId when given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getMonthlyActivityBreakdown(2024, 'g1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('year=2024');
    expect(String(url)).toContain('groupId=g1');
  });

  it('throws a generic error on a non-Error rejection', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    await expect(getMonthlyActivityBreakdown()).rejects.toThrow('Failed to fetch monthly activity breakdown');
  });
});

describe('getWeeklyHeatmapData', () => {
  it('includes year and groupId when given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getWeeklyHeatmapData(2024, 'g1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('year=2024');
    expect(String(url)).toContain('groupId=g1');
  });

  it('throws a generic error on a non-Error rejection', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    await expect(getWeeklyHeatmapData()).rejects.toThrow('Failed to fetch weekly heatmap data');
  });
});

describe('getCumulativeTimelineData', () => {
  it('includes year and groupId when given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getCumulativeTimelineData(2024, 'g1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('year=2024');
    expect(String(url)).toContain('groupId=g1');
  });

  it('throws a generic error on a non-Error rejection', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    await expect(getCumulativeTimelineData()).rejects.toThrow('Failed to fetch cumulative timeline data');
  });
});
