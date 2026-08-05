import { logger } from '@tumbaland/frontend-core';

/**
 * Place lookup via OpenStreetMap's Nominatim.
 *
 * This is the one call in the app that leaves our own infrastructure, so it is
 * deliberately conservative: it fires only from an explicit search in the day
 * editor (never on page load), sends nothing but the typed query, and is
 * throttled to Nominatim's published usage policy of at most one request per
 * second. Places already saved are matched locally first, so revisiting a place
 * needs no lookup at all.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Nominatim asks for at most 1 request/second from a given client. */
const MIN_INTERVAL_MS = 1000;

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  /** the full address line, shown as secondary text in the picker */
  detail: string;
}

interface NominatimHit {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

let lastRequestAt = 0;

/** Resolves once the client is allowed to issue another Nominatim request. */
const throttle = async (): Promise<void> => {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
};

/**
 * Search for a place by name. Returns [] on any failure — a geocoder being
 * unreachable must never block logging a day, since the map can still be
 * pinned by hand.
 */
export const searchPlaces = async (
  query: string,
  options?: { signal?: AbortSignal; limit?: number }
): Promise<GeocodeResult[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  await throttle();
  if (options?.signal?.aborted) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '0',
    limit: String(options?.limit ?? 6)
  });

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal: options?.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      logger.warn('Place search failed', { status: response.status });
      return [];
    }

    const hits: NominatimHit[] = await response.json();
    return hits
      .map((hit) => {
        const lat = parseFloat(hit.lat ?? '');
        const lng = parseFloat(hit.lon ?? '');
        const detail = hit.display_name ?? '';
        // jsonv2 gives a short `name` for POIs; fall back to the first
        // component of the address line for plain streets/addresses.
        const label = hit.name?.trim() || detail.split(',')[0]?.trim() || '';
        if (!label || !isFinite(lat) || !isFinite(lng)) return null;
        return { label, lat, lng, detail };
      })
      .filter((result): result is GeocodeResult => result !== null);
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return [];
    logger.error('Place search failed', error);
    return [];
  }
};
