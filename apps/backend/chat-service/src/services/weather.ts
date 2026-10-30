import { logger } from '@tumbaland/backend-core';
import type { ClientTool } from './assistantClaude';
import { searchPlaces as geocode } from './geocodingService';
import { hourlyLimit } from './hourlyLimit';

/**
 * The weather for a place and a day, from Open-Meteo: a forecast up to two
 * weeks ahead, and the last week as it was.
 *
 * Free and without a key, for non-commercial use. Answers are cached for half
 * an hour: the forecast does not change faster.
 */

const DEFAULT_CENTER = { lat: 59.437, lng: 24.7536, name: 'Tallinn' };
const DAYS_AHEAD = 15;
const DAYS_BACK = 7;
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 200;
/** Hours of the day shown, so a day reads as a few lines rather than twenty-four. */
const SHOWN_HOURS = [6, 9, 12, 15, 18, 21];

/** WMO weather codes, as Open-Meteo gives them. */
const WEATHER: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm with hail',
  99: 'thunderstorm with hail'
};
const described = (code: number | null | undefined): string => (code === null || code === undefined ? 'unknown' : (WEATHER[code] ?? 'unknown'));

interface Forecast {
  daily?: {
    time: string[];
    weather_code: Array<number | null>;
    temperature_2m_max: Array<number | null>;
    temperature_2m_min: Array<number | null>;
    precipitation_sum: Array<number | null>;
    precipitation_probability_max: Array<number | null>;
    wind_speed_10m_max: Array<number | null>;
    sunrise: string[];
    sunset: string[];
  };
  hourly?: {
    time: string[];
    temperature_2m: Array<number | null>;
    precipitation_probability: Array<number | null>;
    weather_code: Array<number | null>;
    wind_speed_10m: Array<number | null>;
  };
}

const cache = new Map<string, { at: number; forecast: Forecast }>();
const limit = hourlyLimit(30, 'The weather has been looked up 30 times this hour in this chat. Answer from what was found.');

export function resetWeather(): void {
  cache.clear();
  limit.reset();
}

/** A local day, `days` from the day `now` falls on in the zone. */
export function localDay(now: Date, timeZone: string, days = 0): string {
  const today = now.toLocaleDateString('sv-SE', { timeZone });
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function forecastUrl(lat: number, lng: number, from: string, to: string, timeZone: string): URL {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
    wind_speed_unit: 'ms',
    timezone: timeZone,
    start_date: from,
    end_date: to
  }).toString();
  return url;
}

async function fetchForecast(conversationId: string, url: URL): Promise<Forecast> {
  const key = url.toString();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.forecast;

  limit.take(conversationId, now);

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch((error: Error) => {
    logger.warn('Open-Meteo request failed', { error: error.message });
    return null;
  });
  if (!response?.ok) {
    if (response) logger.warn('Open-Meteo refused', { status: response.status });
    throw new Error('The weather service is not answering right now. Use the web search instead.');
  }
  const forecast = (await response.json()) as Forecast;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, forecast });
  return forecast;
}

const round = (value: number | null | undefined, unit: string): string => (value === null || value === undefined ? '?' : `${Math.round(value)}${unit}`);

/** The forecast as lines the assistant can read: each day, then a few hours of it. */
export function present(forecast: Forecast, place: string, past: boolean): string {
  const daily = forecast.daily;
  if (!daily || daily.time.length === 0) return `No weather found for ${place} on those days.`;
  const lines = [`Weather for ${place} (${past ? 'as it was' : 'forecast'}, from Open-Meteo; temperatures in °C, wind in m/s, local time):`];
  daily.time.forEach((day, i) => {
    const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    const rain = daily.precipitation_sum[i] ? `, ${daily.precipitation_sum[i]!.toFixed(1)} mm` : '';
    const chance = daily.precipitation_probability_max[i] !== null && daily.precipitation_probability_max[i] !== undefined ? `, ${daily.precipitation_probability_max[i]}% chance of rain` : '';
    lines.push(
      `${weekday} ${day}: ${described(daily.weather_code[i])}, ${round(daily.temperature_2m_min[i], '°')} to ${round(daily.temperature_2m_max[i], '°')}${chance}${rain}, wind up to ${round(daily.wind_speed_10m_max[i], ' m/s')}. Sunrise ${daily.sunrise[i]?.slice(11) ?? '?'}, sunset ${daily.sunset[i]?.slice(11) ?? '?'}.`
    );
    const hourly = forecast.hourly;
    if (!hourly) return;
    const hours = SHOWN_HOURS.map((hour) => hourly.time.indexOf(`${day}T${String(hour).padStart(2, '0')}:00`)).filter((index) => index >= 0);
    if (hours.length === 0) return;
    lines.push(
      `  ${hours
        .map((index) => {
          const chanceAt = hourly.precipitation_probability[index];
          return `${hourly.time[index]!.slice(11)} ${round(hourly.temperature_2m[index], '°')} ${described(hourly.weather_code[index])}${chanceAt ? ` (${chanceAt}% rain)` : ''}`;
        })
        .join(' · ')}`
    );
  });
  return lines.join('\n');
}

/** Whether a YYYY-MM-DD names a real day: Date.parse takes 2026-02-31 and makes it 3 March. */
const isRealDay = (day: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

export function weatherTools(conversationId: string, timeZone: string, now: () => Date = () => new Date()): ClientTool[] {
  return [
    {
      name: 'get_weather',
      description:
        `The weather for a place: a forecast up to ${DAYS_AHEAD} days ahead, or what it was in the last ${DAYS_BACK} days. Each day with its low and high, ` +
        'rain and its chance, wind, sunrise and sunset, and a few hours of the day. Give the day or days asked about, not more. ' +
        'A forecast more than a few days out is a rough guide: say so.',
      input_schema: {
        type: 'object',
        properties: {
          area: { type: 'string', description: 'A city, neighbourhood or place, e.g. "Pärnu" or "Kalamaja, Tallinn". Tallinn when left out.' },
          date: { type: 'string', description: 'The day, YYYY-MM-DD, local. Today when left out.' },
          end_date: { type: 'string', description: 'The last day, YYYY-MM-DD, for a stretch of days such as a weekend. At most 7 days after date.' }
        }
      },
      run: async (raw) => {
        const input = raw as { area?: string; date?: string; end_date?: string };
        const today = localDay(now(), timeZone);
        const from = input.date ?? today;
        const to = input.end_date ?? from;
        if (!isRealDay(from) || !isRealDay(to)) return 'Dates must be real days, written YYYY-MM-DD.';
        if (to < from) return 'end_date is before date.';
        const earliest = localDay(now(), timeZone, -DAYS_BACK);
        const latest = localDay(now(), timeZone, DAYS_AHEAD);
        if (from < earliest || to > latest) return `There is weather only from ${earliest} to ${latest}. For anything else, use the web search.`;
        if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 7) return 'Ask for at most a week at a time.';

        let place = DEFAULT_CENTER;
        if (input.area?.trim()) {
          const [found] = await geocode(input.area, DEFAULT_CENTER);
          if (!found) return `Could not find "${input.area}" on the map.`;
          place = { lat: found.lat, lng: found.lng, name: [found.name, found.detail.split(',')[0]].filter(Boolean).join(', ') };
        }

        try {
          const forecast = await fetchForecast(conversationId, forecastUrl(place.lat, place.lng, from, to, timeZone));
          return present(forecast, place.name, to < today);
        } catch (error) {
          return (error as Error).message;
        }
      }
    }
  ];
}
