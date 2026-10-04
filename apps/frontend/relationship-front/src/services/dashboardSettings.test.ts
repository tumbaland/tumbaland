import { vi } from 'vite-plus/test';
import { getDashboardSettings, saveDashboardSettings } from './dashboardSettings';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

describe('getDashboardSettings', () => {
  it('passes groupId as a query param when given', async () => {
    mockFetchOnce({ success: true, data: { highlightTypeIds: [], hiddenTypeIds: [] } });
    await getDashboardSettings('g1');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('groupId=g1');
  });

  it('omits groupId when not given', async () => {
    mockFetchOnce({ success: true, data: { highlightTypeIds: [], hiddenTypeIds: [] } });
    await getDashboardSettings();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('groupId');
  });
});

describe('saveDashboardSettings', () => {
  it('PUTs the settings, including groupId when given', async () => {
    mockFetchOnce({ success: true, data: { highlightTypeIds: ['t1'], hiddenTypeIds: [] } });
    await saveDashboardSettings({ highlightTypeIds: ['t1'], hiddenTypeIds: [] }, 'g1');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(init!.body as string)).toEqual({ highlightTypeIds: ['t1'], hiddenTypeIds: [], groupId: 'g1' });
  });

  it('omits groupId from the payload when not given', async () => {
    mockFetchOnce({ success: true, data: { highlightTypeIds: [], hiddenTypeIds: [] } });
    await saveDashboardSettings({ highlightTypeIds: [], hiddenTypeIds: [] });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ highlightTypeIds: [], hiddenTypeIds: [] });
  });
});
