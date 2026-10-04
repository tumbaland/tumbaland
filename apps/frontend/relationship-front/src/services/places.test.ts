import { vi } from 'vite-plus/test';
import { getPlaces, getPlaceVisits } from './places';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

const lastUrl = () => String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);

describe('getPlaces', () => {
  it('requests places without a query string when unfiltered', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getPlaces();

    expect(lastUrl()).toMatch(/\/places$/);
  });

  it('builds query params from every filter', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getPlaces({ groupId: 'g1', typeId: 't1', startDate: '2024-01-01', endDate: '2024-12-31' });

    const url = lastUrl();
    expect(url).toContain('groupId=g1');
    expect(url).toContain('typeId=t1');
    expect(url).toContain('startDate=2024-01-01');
    expect(url).toContain('endDate=2024-12-31');
  });

  it('unwraps the response envelope', async () => {
    const places = [{ id: '1,2', label: 'Home', lat: 1, lng: 2, visits: 3 }];
    mockFetchOnce({ success: true, data: places });

    await expect(getPlaces()).resolves.toEqual(places);
  });
});

describe('getPlaceVisits', () => {
  it('sends the coordinates as required params', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getPlaceVisits(59.4405, 24.7453);

    const url = lastUrl();
    expect(url).toContain('/places/visits?');
    expect(url).toContain('lat=59.4405');
    expect(url).toContain('lng=24.7453');
    expect(url).not.toContain('groupId');
    expect(url).not.toContain('limit');
  });

  it('adds the group and limit when given', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getPlaceVisits(1, 2, { groupId: 'g1', limit: 5 });

    const url = lastUrl();
    expect(url).toContain('groupId=g1');
    expect(url).toContain('limit=5');
  });

  it('unwraps the response envelope', async () => {
    const visits = [{ date: '2024-06-11', typeId: 't1' }];
    mockFetchOnce({ success: true, data: visits });

    await expect(getPlaceVisits(1, 2)).resolves.toEqual(visits);
  });
});
