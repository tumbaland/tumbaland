import { logger } from '@tumbaland/backend-core';
import type { ClientTool } from './assistantClaude';
import { searchPlaces as geocode } from './geocodingService';
import { hourlyLimit } from './hourlyLimit';
import { isOpenAt, parseMoment } from './openingHours';

/**
 * Somewhere to eat or drink, from OpenStreetMap, and when it is open.
 *
 * Free, and no key: places come from the Overpass API and an area's name from
 * Photon, the geocoder the map already uses. What it does not have is just as
 * plain: no prices, no ratings, no reviews, and opening hours that volunteers
 * typed in, missing on many places and out of date on some. The assistant is
 * told so, and uses web search for the rest.
 *
 * Overpass is a shared public server, so searches are small, cached, and
 * limited for each conversation. `OVERPASS_URL` points at one of our own.
 */

const overpassUrl = (): string => process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

/** Where "near" means when no area is named: the middle of Tallinn. */
const DEFAULT_CENTER = { lat: 59.437, lng: 24.7536 };
const DEFAULT_RADIUS_M = 2_500;
const MAX_RADIUS_M = 10_000;
const TIMEOUT_MS = 20_000;
/** Places taken from Overpass before sorting. Names are all that is asked for, so it stays small. */
const POOL = 80;

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 100;

const KINDS = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food'] as const;

interface Element {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface Found {
  id: string;
  name: string;
  kind: string;
  cuisine?: string;
  address?: string;
  distance: number;
  hours?: string;
  website?: string;
  phone?: string;
  lat: number;
  lng: number;
}

const cache = new Map<string, { at: number; found: Found[] }>();
const limit = hourlyLimit(20, 'The place search has been used 20 times this hour in this chat. Answer from what was found, or use the web search.');

export function resetPlaceFinder(): void {
  cache.clear();
  limit.reset();
}

/** Letters, digits, spaces and a few marks: nothing that can change what the query means. */
const safe = (text: string): string => text.replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 40);

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

function addressOf(tags: Record<string, string>): string | undefined {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  return [street, tags['addr:city']].filter(Boolean).join(', ') || undefined;
}

export interface Query {
  kind?: (typeof KINDS)[number];
  cuisine?: string;
  name?: string;
  center: { lat: number; lng: number };
  radius: number;
}

function overpassQuery({ kind, cuisine, name, center, radius }: Query): string {
  const amenity = kind ?? KINDS.join('|');
  const filters = [
    cuisine && safe(cuisine) ? `["cuisine"~"${safe(cuisine)}",i]` : '',
    name && safe(name) ? `["name"~"${safe(name)}",i]` : ''
  ].join('');
  return `[out:json][timeout:15];nwr["amenity"~"^(${amenity})$"]["name"]${filters}(around:${radius},${center.lat},${center.lng});out center tags ${POOL};`;
}

export async function findPlaces(conversationId: string, query: Query): Promise<Found[]> {
  const key = JSON.stringify(query);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.found;

  limit.take(conversationId, now);

  const response = await fetch(overpassUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Tumbaland/1.0 (chat assistant)' },
    body: new URLSearchParams({ data: overpassQuery(query) }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }).catch((error: Error) => {
    logger.warn('Overpass request failed', { error: error.message });
    return null;
  });
  if (!response?.ok) {
    if (response) logger.warn('Overpass refused', { status: response.status });
    throw new Error('The map search is not answering right now. Use the web search instead.');
  }

  const body = (await response.json().catch(() => null)) as { elements?: Element[] } | null;
  const found = (body?.elements ?? []).flatMap((element): Found[] => {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!tags.name || lat === undefined || lng === undefined) return [];
    return [
      {
        id: `${element.type}/${element.id}`,
        name: tags.name,
        kind: (tags.amenity ?? '').replace('_', ' '),
        cuisine: tags.cuisine?.replace(/;/g, ', ').replace(/_/g, ' '),
        address: addressOf(tags),
        distance: distanceMeters(query.center, { lat, lng }),
        hours: tags.opening_hours,
        website: tags.website ?? tags['contact:website'],
        phone: tags.phone ?? tags['contact:phone'],
        lat,
        lng
      }
    ];
  });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, found });
  return found;
}

const DEFAULT_MAX = 6;

function describe(place: Found, index: number, open: boolean | null | undefined): string {
  const state = open === undefined ? '' : open === null ? 'hours unknown' : open ? 'open then' : 'closed then';
  const hours = place.hours ? `hours on the map: ${place.hours}` : 'no hours on the map';
  return [
    `${index + 1}. ${place.name}, ${place.kind}${place.cuisine ? ` (${place.cuisine})` : ''} · ${place.distance} m`,
    ...(place.address ? [`   ${place.address}`] : []),
    `   ${[state, hours].filter(Boolean).join(' · ')}`,
    `   https://www.openstreetmap.org/${place.id}${place.website ? ` · ${place.website}` : ''}${place.phone ? ` · ${place.phone}` : ''}`
  ].join('\n');
}

/** What the tool answers, for a set of places found: sorted, filtered to the time asked, and said plainly. */
export function present(found: Found[], opts: { openAt?: string; max?: number; area: string }): string {
  const at = opts.openAt ? parseMoment(opts.openAt) : null;
  const rated = found.map((place) => ({ place, open: at ? isOpenAt(place.hours, at.weekday, at.minutes) : undefined }));
  // Confirmed open first, then unknown, each nearest first. Confirmed closed is left out.
  const rank = (open: boolean | null | undefined): number => (open === true ? 0 : open === null ? 1 : 2);
  const shown = rated
    .filter(({ open }) => open !== false)
    .sort((a, b) => rank(a.open) - rank(b.open) || a.place.distance - b.place.distance)
    .slice(0, opts.max ?? DEFAULT_MAX);

  if (shown.length === 0) {
    return found.length === 0
      ? `No places found near ${opts.area}. Try a wider radius, another kind, or the web search.`
      : `${found.length} places found near ${opts.area}, but none is open at ${opts.openAt} by the hours on the map. Try another time, or the web search.`;
  }
  const unknown = shown.filter(({ open }) => open === null).length;
  return [
    `Places near ${opts.area}${opts.openAt ? ` open at ${opts.openAt}` : ''}, from OpenStreetMap. Hours are entered by volunteers and can be missing or out of date${unknown ? `; ${unknown} here have none the map can read` : ''}. The map has no prices or ratings: use the web search for those.`,
    ...shown.map(({ place, open }, index) => describe(place, index, open))
  ].join('\n');
}

export function placeTools(conversationId: string): ClientTool[] {
  return [
    {
      name: 'find_places',
      description:
        'Find restaurants, cafés, bars and pubs near an area on OpenStreetMap, with their opening hours where the map has them. ' +
        'To check when one place is open, pass its name. ' +
        'To find places open at a time, pass open_at as the local time at the place ("after 21:00 on Friday" is that Friday at 21:00): ' +
        'places the map shows as closed then are left out, and places with no readable hours are listed last, marked unknown. ' +
        'The map has no prices, ratings or menus: for those, and to check a place is really open, use the web search afterwards. ' +
        'Put only the area and the kind of place in it, never anything private about the people.',
      input_schema: {
        type: 'object',
        properties: {
          area: { type: 'string', description: 'A neighbourhood, street or landmark, e.g. "Kalamaja, Tallinn". Tallinn city centre when left out.' },
          kind: { type: 'string', enum: [...KINDS], description: 'Leave out for any of them' },
          cuisine: { type: 'string', description: 'e.g. sushi, pizza, italian, vegan' },
          name: { type: 'string', description: 'Part of a place\'s name, to look up one you already know' },
          open_at: { type: 'string', description: 'Local time at the place, YYYY-MM-DDTHH:mm, e.g. 2026-10-30T21:30' },
          radius_m: { type: 'integer', description: `How far from the area, in metres. ${DEFAULT_RADIUS_M} by default, ${MAX_RADIUS_M} at most` },
          max_results: { type: 'integer', description: `How many to show, ${DEFAULT_MAX} by default` }
        }
      },
      run: async (raw) => {
        const input = raw as { area?: string; kind?: string; cuisine?: string; name?: string; open_at?: string; radius_m?: number; max_results?: number };
        if (input.open_at && !parseMoment(input.open_at)) return 'open_at must be a real local time written YYYY-MM-DDTHH:mm, for example 2026-10-30T21:30.';
        const kind = KINDS.find((candidate) => candidate === input.kind);

        let center = DEFAULT_CENTER;
        let area = 'central Tallinn';
        if (input.area?.trim()) {
          const [place] = await geocode(input.area, DEFAULT_CENTER);
          if (!place) return `Could not find "${input.area}" on the map. Try a neighbourhood or a street in Tallinn.`;
          center = { lat: place.lat, lng: place.lng };
          area = place.name;
        }

        try {
          const found = await findPlaces(conversationId, {
            kind,
            cuisine: input.cuisine,
            name: input.name,
            center,
            radius: Math.min(Math.max(Math.round(input.radius_m ?? DEFAULT_RADIUS_M), 200), MAX_RADIUS_M)
          });
          return present(found, { openAt: input.open_at, max: Math.min(Math.max(Math.round(input.max_results ?? DEFAULT_MAX), 1), 12), area });
        } catch (error) {
          return (error as Error).message;
        }
      }
    }
  ];
}
