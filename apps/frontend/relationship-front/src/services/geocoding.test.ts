import { vi, beforeEach, afterEach } from 'vite-plus/test';
import { searchPlaces } from './geocoding';

const mockedFetch = () => global.fetch as ReturnType<typeof vi.fn>;

function mockHits(hits: unknown[]) {
  mockedFetch().mockResolvedValueOnce({ ok: true, status: 200, json: async () => hits } as Response);
}

// The service throttles itself to Nominatim's 1 req/s policy; fake timers would
// deadlock on its internal sleep, so tests advance real time instead by
// resetting the module between cases.
beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('searchPlaces', () => {
  it.each([
    ['', 0],
    ['ko', 0],
    ['  k  ', 0]
  ])('does not call the geocoder for a query shorter than 3 characters (%j)', async (query) => {
    await expect(searchPlaces(query as string)).resolves.toEqual([]);
    expect(mockedFetch()).not.toHaveBeenCalled();
  });

  it('maps Nominatim hits into results, preferring the short name', async () => {
    mockHits([{ name: 'Sushi House', display_name: 'Sushi House, Pikk 71, Tallinn', lat: '59.4405', lon: '24.7453' }]);

    await expect(searchPlaces('sushi house')).resolves.toEqual([
      {
        label: 'Sushi House',
        lat: 59.4405,
        lng: 24.7453,
        detail: 'Sushi House, Pikk 71, Tallinn'
      }
    ]);
  });

  it('falls back to the first address component when a hit has no short name', async () => {
    mockHits([{ display_name: 'Pikk 71, Tallinn, Estonia', lat: '59.44', lon: '24.74' }]);

    const [result] = await searchPlaces('pikk 71');

    expect(result.label).toBe('Pikk 71');
    expect(result.detail).toBe('Pikk 71, Tallinn, Estonia');
  });

  it('drops hits with unusable coordinates or no name', async () => {
    mockHits([
      { name: 'Good', display_name: 'Good place', lat: '1', lon: '2' },
      { name: 'No coords', display_name: 'x' },
      { name: '', display_name: '', lat: '3', lon: '4' }
    ]);

    const results = await searchPlaces('anything');

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Good');
  });

  it('sends the query and a bounded result limit', async () => {
    mockHits([]);

    await searchPlaces('tallinn', { limit: 3 });

    const url = String(mockedFetch().mock.calls[0][0]);
    expect(url).toContain('nominatim.openstreetmap.org');
    expect(url).toContain('q=tallinn');
    expect(url).toContain('limit=3');
  });

  it('returns an empty list when the geocoder responds with an error status', async () => {
    mockedFetch().mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) } as Response);

    await expect(searchPlaces('tallinn')).resolves.toEqual([]);
  });

  it('returns an empty list when the request throws', async () => {
    mockedFetch().mockRejectedValueOnce(new Error('offline'));

    await expect(searchPlaces('tallinn')).resolves.toEqual([]);
  });

  it('returns an empty list when the request is aborted', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mockedFetch().mockRejectedValueOnce(abortError);

    await expect(searchPlaces('tallinn')).resolves.toEqual([]);
  });

  it('skips the request when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(searchPlaces('tallinn', { signal: controller.signal })).resolves.toEqual([]);
    expect(mockedFetch()).not.toHaveBeenCalled();
  });
});
