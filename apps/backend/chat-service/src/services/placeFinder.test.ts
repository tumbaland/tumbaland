jest.mock('./geocodingService', () => ({ searchPlaces: jest.fn() }));

import { searchPlaces } from './geocodingService';
import { findPlaces, placeTools, present, resetPlaceFinder, type Found } from './placeFinder';

const find = (input: Record<string, unknown>, id = 'c1') => placeTools(id)[0]!.run(input);

const element = (id: number, name: string, tags: Record<string, string> = {}, at = { lat: 59.44, lon: 24.75 }) => ({
  type: 'node',
  id,
  ...at,
  tags: { name, amenity: 'restaurant', ...tags }
});

const fetchMock = jest.fn();
const overpass = (elements: unknown[], ok = true) =>
  fetchMock.mockResolvedValueOnce({ ok, status: ok ? 200 : 429, json: async () => ({ elements }) });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as never;
  (searchPlaces as jest.Mock).mockReset();
  resetPlaceFinder();
});

const place = (over: Partial<Found>): Found => ({ id: 'node/1', name: 'A', kind: 'restaurant', distance: 100, lat: 0, lng: 0, ...over });

describe('present', () => {
  const found = [
    place({ id: 'node/1', name: 'Far Open', distance: 900, hours: 'Mo-Su 12:00-23:00' }),
    place({ id: 'node/2', name: 'Near Open', distance: 200, hours: 'Mo-Su 12:00-23:00' }),
    place({ id: 'node/3', name: 'Shut', distance: 50, hours: 'Mo-Su 10:00-20:00' }),
    place({ id: 'node/4', name: 'No Hours', distance: 10 })
  ];

  it('leaves out what the map shows closed, lists open first nearest first, and unknown last', () => {
    const text = present(found, { openAt: '2026-10-30T21:30', area: 'Kalamaja' });
    expect(text).not.toContain('Shut');
    expect(text.indexOf('Near Open')).toBeLessThan(text.indexOf('Far Open'));
    expect(text.indexOf('Far Open')).toBeLessThan(text.indexOf('No Hours'));
    expect(text).toContain('open then');
    expect(text).toContain('hours unknown');
    expect(text).toContain('no prices or ratings');
  });

  it('says so when nothing is open then', () => {
    expect(present([found[2]!], { openAt: '2026-10-30T21:30', area: 'Kalamaja' })).toMatch(/none is open at 2026-10-30T21:30/);
  });

  it('says so when nothing was found', () => {
    expect(present([], { area: 'Kalamaja' })).toMatch(/No places found near Kalamaja/);
  });
});

describe('find_places', () => {
  it('asks Overpass for named eating places around the middle of Tallinn, and shows what it has', async () => {
    overpass([element(1, 'Kolm Sõpra', { cuisine: 'estonian', 'addr:street': 'Rataskaevu', 'addr:housenumber': '16', opening_hours: 'Mo-Su 12:00-23:00', website: 'https://kolm.example' })]);
    const text = await find({ open_at: '2026-10-30T21:30' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://overpass-api.de/api/interpreter');
    const query = init.body.get('data') as string;
    expect(query).toContain('"amenity"~"^(restaurant|cafe|bar|pub|fast_food)$"');
    expect(query).toContain('around:2500,59.437,24.7536');
    expect(text).toContain('Kolm Sõpra, restaurant (estonian)');
    expect(text).toContain('Rataskaevu 16');
    expect(text).toContain('open then');
    expect(text).toContain('https://www.openstreetmap.org/node/1 · https://kolm.example');
  });

  it('centres on an area it finds by name, and keeps a cuisine out of the way of the query syntax', async () => {
    (searchPlaces as jest.Mock).mockResolvedValue([{ name: 'Kalamaja', detail: 'Tallinn', lat: 59.45, lng: 24.73 }]);
    overpass([]);
    const text = await find({ area: 'Kalamaja', cuisine: 'sushi"];out;' });
    const query = fetchMock.mock.calls[0]![1].body.get('data') as string;
    expect(query).toContain('around:2500,59.45,24.73');
    expect(query).toContain('["cuisine"~"sushiout",i]');
    expect(query).not.toContain('"];out;');
    expect(text).toMatch(/No places found near Kalamaja/);
  });

  it('says when it cannot find the area, without searching', async () => {
    (searchPlaces as jest.Mock).mockResolvedValue([]);
    expect(await find({ area: 'Nowhereville' })).toMatch(/Could not find "Nowhereville"/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a time it cannot read', async () => {
    expect(await find({ open_at: 'tonight' })).toMatch(/YYYY-MM-DDTHH:mm/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the radius sensible', async () => {
    overpass([]);
    await find({ radius_m: 500_000 });
    expect(fetchMock.mock.calls[0]![1].body.get('data')).toContain('around:10000');
  });

  it('points to the web search when the map server does not answer', async () => {
    overpass([], false);
    expect(await find({})).toMatch(/web search/);
  });

  it('answers the same search from memory, and stops one chat at 20 an hour', async () => {
    overpass([element(1, 'A')]);
    await find({});
    await find({});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 19; i++) {
      overpass([]);
      await find({ name: `place ${i}` });
    }
    expect(await find({ name: 'one more' })).toMatch(/20 times this hour/);
    // Another chat has its own.
    overpass([]);
    expect(await find({ name: 'one more' }, 'c2')).not.toMatch(/20 times/);
  });

  it('drops places with no name or no position', async () => {
    overpass([{ type: 'node', id: 9, lat: 1, lon: 1, tags: { amenity: 'cafe' } }, { type: 'node', id: 8, tags: { name: 'Lost', amenity: 'cafe' } }]);
    expect(await findPlaces('c1', { center: { lat: 1, lng: 1 }, radius: 500 })).toEqual([]);
  });
});
