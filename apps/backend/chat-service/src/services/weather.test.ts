jest.mock('./geocodingService', () => ({ searchPlaces: jest.fn() }));

import { searchPlaces } from './geocodingService';
import { localDay, resetWeather, weatherTools } from './weather';

// Friday 30 October 2026, 20:05 in Tallinn.
const NOW = new Date('2026-10-30T18:05:00Z');
const weather = (input: Record<string, unknown>, id = 'c1') => weatherTools(id, 'Europe/Tallinn', () => NOW)[0]!.run(input);

const forecast = (days: string[]) => ({
  daily: {
    time: days,
    weather_code: days.map(() => 61),
    temperature_2m_max: days.map(() => 9.6),
    temperature_2m_min: days.map(() => 3.2),
    precipitation_sum: days.map(() => 2.44),
    precipitation_probability_max: days.map(() => 70),
    wind_speed_10m_max: days.map(() => 6.2),
    sunrise: days.map((day) => `${day}T08:12`),
    sunset: days.map((day) => `${day}T16:40`)
  },
  hourly: {
    time: days.flatMap((day) => Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00`)),
    temperature_2m: days.flatMap(() => Array.from({ length: 24 }, (_, h) => h / 2)),
    precipitation_probability: days.flatMap(() => Array.from({ length: 24 }, (_, h) => (h === 21 ? 80 : 0))),
    weather_code: days.flatMap(() => Array.from({ length: 24 }, () => 3)),
    wind_speed_10m: days.flatMap(() => Array.from({ length: 24 }, () => 4))
  }
});

const fetchMock = jest.fn();
const answer = (body: unknown, ok = true) => fetchMock.mockResolvedValueOnce({ ok, status: ok ? 200 : 503, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as never;
  (searchPlaces as jest.Mock).mockReset();
  resetWeather();
});

describe('localDay', () => {
  it('is the day on the zone’s own calendar', () => {
    // 23:30 UTC is already the next day in Tallinn.
    expect(localDay(new Date('2026-10-30T23:30:00Z'), 'Europe/Tallinn')).toBe('2026-10-31');
    expect(localDay(NOW, 'Europe/Tallinn', 2)).toBe('2026-11-01');
    expect(localDay(NOW, 'Europe/Tallinn', -7)).toBe('2026-10-23');
  });
});

describe('get_weather', () => {
  it('asks for today in Tallinn, in local time and m/s, and reads the day out', async () => {
    answer(forecast(['2026-10-30']));
    const text = await weather({});

    const url = new URL(fetchMock.mock.calls[0]![0].toString());
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('59.437');
    expect(url.searchParams.get('start_date')).toBe('2026-10-30');
    expect(url.searchParams.get('end_date')).toBe('2026-10-30');
    expect(url.searchParams.get('timezone')).toBe('Europe/Tallinn');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');

    expect(text).toContain('Weather for Tallinn (forecast');
    expect(text).toContain('Friday 2026-10-30: light rain, 3° to 10°, 70% chance of rain, 2.4 mm, wind up to 6 m/s. Sunrise 08:12, sunset 16:40.');
    expect(text).toContain('21:00 11° overcast (80% rain)');
    expect(text).not.toContain('03:00');
  });

  it('finds the place by name, and covers a stretch of days', async () => {
    (searchPlaces as jest.Mock).mockResolvedValue([{ name: 'Pärnu', detail: 'Pärnu maakond, Estonia', lat: 58.385, lng: 24.497 }]);
    answer(forecast(['2026-10-31', '2026-11-01']));
    const text = await weather({ area: 'Pärnu', date: '2026-10-31', end_date: '2026-11-01' });
    expect(new URL(fetchMock.mock.calls[0]![0].toString()).searchParams.get('latitude')).toBe('58.385');
    expect(text).toContain('Weather for Pärnu, Pärnu maakond');
    expect(text).toContain('Saturday 2026-10-31');
    expect(text).toContain('Sunday 2026-11-01');
  });

  it('says a past day is what it was, not a forecast', async () => {
    answer(forecast(['2026-10-28']));
    expect(await weather({ date: '2026-10-28' })).toContain('(as it was');
  });

  it.each([
    [{ date: '30.10.2026' }, /YYYY-MM-DD/],
    [{ date: '2026-02-31' }, /real days/],
    [{ date: '2026-11-02', end_date: '2026-11-01' }, /before date/],
    [{ date: '2026-12-25' }, /only from 2026-10-23 to 2026-11-14/],
    [{ date: '2026-10-01' }, /only from/],
    [{ date: '2026-10-31', end_date: '2026-11-10' }, /at most a week/]
  ])('refuses %o without asking', async (input, message) => {
    expect(await weather(input)).toMatch(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says when it cannot find the place', async () => {
    (searchPlaces as jest.Mock).mockResolvedValue([]);
    expect(await weather({ area: 'Atlantis' })).toMatch(/Could not find "Atlantis"/);
  });

  it('points to the web search when the service does not answer', async () => {
    answer({}, false);
    expect(await weather({})).toMatch(/web search/);
  });

  it('answers the same question from memory, and stops one chat at 30 an hour', async () => {
    answer(forecast(['2026-10-30']));
    await weather({});
    await weather({});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let day = 0; day < 29; day++) {
      answer(forecast(['2026-10-30']));
      await weather({ date: localDay(NOW, 'Europe/Tallinn', (day % 15) + 1), end_date: localDay(NOW, 'Europe/Tallinn', (day % 15) + 1 + Math.floor(day / 15)) });
    }
    expect(await weather({ date: '2026-10-29' })).toMatch(/30 times this hour/);
  });
});
