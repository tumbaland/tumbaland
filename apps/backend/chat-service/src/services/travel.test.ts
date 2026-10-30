jest.mock('./geocodingService', () => ({ searchPlaces: jest.fn() }));

import { searchPlaces } from './geocodingService';
import { resetTravel, travelTools } from './travel';

const route = (input: Record<string, unknown>, id = 'c1') => travelTools(id)[0]!.run(input);
const fetchMock = jest.fn();
const place = (name: string, lat: number, lng: number) => [{ name, detail: 'Tallinn', lat, lng }];
const answer = (body: unknown, ok = true) => fetchMock.mockResolvedValueOnce({ ok, status: ok ? 200 : 502, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as never;
  (searchPlaces as jest.Mock).mockReset().mockImplementation(async (query: string) => (query === 'nowhere' ? [] : query === 'A' ? place('Viru väljak', 59.437, 24.7536) : place('Telliskivi 60a', 59.4539, 24.73)));
  resetTravel();
});

it('asks the foot server for a walk, lon first, and says how far and how long', async () => {
  answer({ code: 'Ok', routes: [{ distance: 2684.1, duration: 2104.9 }] });
  const text = await route({ from: 'A', to: 'B' });
  expect(fetchMock.mock.calls[0]![0]).toBe('https://routing.openstreetmap.de/routed-foot/route/v1/driving/24.7536,59.437;24.73,59.4539?overview=false');
  expect(text).toBe('Walking from Viru väljak to Telliskivi 60a: 2.7 km, about 35 min (OpenStreetMap routing; no public transport).');
});

it('uses the bike and car servers, and says a car’s time has no traffic in it', async () => {
  answer({ code: 'Ok', routes: [{ distance: 900, duration: 4000 }] });
  expect(await route({ from: 'A', to: 'B', mode: 'bike' })).toContain('Cycling from');
  expect(fetchMock.mock.calls[0]![0]).toContain('/routed-bike/');
  answer({ code: 'Ok', routes: [{ distance: 20_000, duration: 1500 }] });
  const car = await route({ from: 'A', to: 'B', mode: 'car' });
  expect(fetchMock.mock.calls[1]![0]).toContain('/routed-car/');
  expect(car).toContain('20 km, about 25 min (OpenStreetMap routing, without traffic');
});

it('asks for what is missing, and says when it cannot find an end', async () => {
  expect(await route({ from: 'A' })).toMatch(/both where from and where to/);
  expect(await route({ from: 'nowhere', to: 'B' })).toMatch(/Could not find "nowhere"/);
  expect(await route({ from: 'A', to: 'nowhere' })).toMatch(/Could not find "nowhere"/);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('says so when there is no route, or the service does not answer', async () => {
  answer({ code: 'NoRoute', routes: [] });
  expect(await route({ from: 'A', to: 'B' })).toMatch(/No walking route/);
  answer({}, false);
  expect(await route({ from: 'A', to: 'B' })).toMatch(/web search/);
});

it('stops one chat at 30 an hour', async () => {
  for (let i = 0; i < 30; i++) {
    answer({ code: 'Ok', routes: [{ distance: 1, duration: 1 }] });
    await route({ from: 'A', to: 'B' });
  }
  expect(await route({ from: 'A', to: 'B' })).toMatch(/30 times this hour/);
});
