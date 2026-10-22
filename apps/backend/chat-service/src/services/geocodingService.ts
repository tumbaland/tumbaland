import { logger } from '@tumbaland/backend-core';

/**
 * Addresses for points on the map, and places found by name, for sharing
 * where one is.
 *
 * Photon (komoot's OpenStreetMap geocoder) rather than Nominatim, which the
 * journal's day editor uses: Nominatim's usage policy forbids search as you
 * type, and the map's search box is exactly that. Asked from here rather than
 * from the browser, so the service sees this server, not each phone, and its
 * answers are cached. `PHOTON_URL` points at a self-hosted Photon if one is run.
 *
 * Never throws: a geocoder being down costs an address line, and the map can
 * still be tapped.
 */

const baseUrl = (): string => (process.env.PHOTON_URL || 'https://photon.komoot.io').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_SIZE = 500;

export interface PlaceResult {
  /** "Viru väljak 4", or a place's own name: "Kalev Spa". */
  name: string;
  /** The rest of the address: "Kesklinn, Tallinn, Estonia". */
  detail: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    country?: string;
  };
}

/** Newest last; the oldest goes when full. */
const cache = new Map<string, unknown>();

function remember<T>(key: string, value: T): T {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return value;
}

export function clearGeocodeCache(): void {
  cache.clear();
}

/** A Photon feature as a name and an address line, or null for one without a usable point. */
export function toPlace(feature: PhotonFeature): PlaceResult | null {
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const p = feature.properties ?? {};
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = p.name || street || p.district || p.city || '';
  if (!name) return null;
  const detail = [p.name && street ? street : null, p.district, p.city, p.country]
    .filter((part): part is string => Boolean(part) && part !== name)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(', ');
  return { name, detail, lat, lng };
}

async function photon(path: string, params: Record<string, string>): Promise<PhotonFeature[] | null> {
  const url = `${baseUrl()}${path}?${new URLSearchParams(params).toString()}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Tumbaland (https://tumbaland.eu)' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      logger.warn('Geocoder answered with an error', { status: response.status, path });
      return null;
    }
    const body = (await response.json()) as { features?: PhotonFeature[] };
    return body.features ?? [];
  } catch (error) {
    logger.warn('Geocoder unreachable', { error: (error as Error).message, path });
    return null;
  }
}

/** Places matching what was typed, nearest first when a point is given. */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Near is rounded so a moving car still hits the cache, and says no more than the town.
  const bias = near ? { lat: near.lat.toFixed(2), lon: near.lng.toFixed(2) } : null;
  const key = `search:${q.toLowerCase()}:${bias ? `${bias.lat},${bias.lon}` : ''}`;
  if (cache.has(key)) return remember(key, cache.get(key) as PlaceResult[]);

  const features = await photon('/api', { q, limit: '6', ...(bias ?? {}) });
  if (!features) return [];
  return remember(
    key,
    features.map(toPlace).filter((place): place is PlaceResult => place !== null)
  );
}

/** The address at a point, or null when there is none to give. */
export async function placeAt(lat: number, lng: number): Promise<PlaceResult | null> {
  // About a metre: a dot dragged a hair further is the same house.
  const key = `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(key)) return remember(key, cache.get(key) as PlaceResult | null);

  const features = await photon('/reverse', { lat: String(lat), lon: String(lng), limit: '1' });
  if (!features) return null;
  const found = features.map(toPlace).find((place): place is PlaceResult => place !== null) ?? null;
  // The point asked about, not the one the geocoder snapped to: the pin stays where it was put.
  return remember(key, found ? { ...found, lat, lng } : null);
}
