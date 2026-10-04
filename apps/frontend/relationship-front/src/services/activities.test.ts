import { vi } from 'vite-plus/test';
import { getActivityDescriptions, getRecentActivitiesSummary } from './activities';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

describe('getActivityDescriptions', () => {
  it('includes groupId when given', async () => {
    mockFetchOnce({ success: true, data: ['a', 'b'] });
    const result = await getActivityDescriptions('type1', 'g1');
    expect(result).toEqual(['a', 'b']);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('typeId=type1');
    expect(String(url)).toContain('groupId=g1');
  });

  it('omits groupId when not given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getActivityDescriptions('type1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('groupId');
  });
});

describe('getRecentActivitiesSummary', () => {
  it('passes groupId as a query param when given', async () => {
    mockFetchOnce({ success: true, data: {} });
    await getRecentActivitiesSummary('g1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('groupId=g1');
  });

  it('omits groupId when not given', async () => {
    mockFetchOnce({ success: true, data: {} });
    await getRecentActivitiesSummary();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('groupId');
  });
});
