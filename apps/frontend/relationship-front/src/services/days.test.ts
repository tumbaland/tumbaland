import { vi } from 'vitest';
import { getDays, saveDay } from './days';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200, json: async () => body } as Response);
}

describe('getDays', () => {
  it('builds query params from every filter', async () => {
    mockFetchOnce({ success: true, data: { days: [], total: 0, page: 1, totalPages: 0 } });

    await getDays({
      page: 2,
      limit: 10,
      typeId: 't1',
      search: 'coffee',
      startDate: '2024-01-01',
      endDate: '2024-02-01',
      groupId: 'g1'
    });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const str = String(url);
    expect(str).toContain('page=2');
    expect(str).toContain('limit=10');
    expect(str).toContain('typeId=t1');
    expect(str).toContain('search=coffee');
    expect(str).toContain('startDate=2024-01-01');
    expect(str).toContain('endDate=2024-02-01');
    expect(str).toContain('groupId=g1');
  });

  it('omits the query string entirely when no filters are given', async () => {
    mockFetchOnce({ success: true, data: { days: [], total: 0, page: 1, totalPages: 0 } });
    await getDays();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('?');
  });
});

describe('saveDay', () => {
  it('PUTs entries, including groupId when given', async () => {
    mockFetchOnce({ success: true, data: { date: '2024-05-01', entries: [] } });
    await saveDay('2024-05-01', [{ typeId: 't1' }], 'g1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/days/2024-05-01');
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(init!.body as string)).toEqual({ entries: [{ typeId: 't1' }], groupId: 'g1' });
  });

  it('omits groupId from the payload when not given', async () => {
    mockFetchOnce({ success: true, data: { date: '2024-05-01', entries: [] } });
    await saveDay('2024-05-01', []);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ entries: [] });
  });
});
