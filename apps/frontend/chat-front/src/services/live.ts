/**
 * Sharing where one is, live, from a browser.
 *
 * A web page gets positions only while it is on screen: Android pauses a page
 * that is hidden or behind a locked screen, and there is no way for a page to
 * keep tracking in the background. So drive mode keeps the screen on with a
 * wake lock and shows Tumbaland while it shares, and the people watching are
 * always told how old the position is.
 */

/** How close counts, for "tell me when they are close", in metres. */
export const RADII = [500, 1000, 2000, 5000] as const;

/** A position older than this is said to be old rather than shown as live. */
export const STALE_MS = 60_000;

/** The colours of the two points on the map: the person, and where they are going. */
export const PERSON_COLOR = '#e91e63';
export const DESTINATION_COLOR = '#2e7d32';

export const isGeolocationSupported = (): boolean => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** Metres between two points, along the Earth's surface. */
export function distanceBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Directions to a point in the phone's own maps app (Google Maps opens the
 * app where it is installed). The point leaves Tumbaland only when this is
 * tapped.
 */
export function directionsUrl(point: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}

/** "900 m", "3.2 km", "15 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** "just now", "40 s ago", "3 min ago", "1 h 5 min ago". */
export function ageText(at: string | number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`;
}

/** What went wrong getting a position, in words for the person. */
export function positionError(error: GeolocationPositionError | { code: number }): string {
  if (error.code === 1) return 'Location is blocked. Allow it for this site in the browser, then try again.';
  if (error.code === 3) return 'Could not find where you are in time. Try again outside or near a window.';
  return 'Could not find where you are.';
}

/** Where the phone is, once. Rejects with words for the person. */
export function currentPosition(options: PositionOptions = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('This browser cannot tell where you are.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(positionError(error))), {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 30_000,
      ...options
    });
  });
}

/** What the server is sent of a position: the parts it keeps, rounded to what they mean. */
export function toLivePosition(coords: GeolocationCoordinates) {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null,
    heading: coords.heading !== null && Number.isFinite(coords.heading) ? Math.round(coords.heading) : null,
    speed: coords.speed !== null && Number.isFinite(coords.speed) ? Math.round(coords.speed * 10) / 10 : null
  };
}

/** km/h from metres per second, for "52 km/h". */
export const kmh = (metresPerSecond: number): number => Math.round(metresPerSecond * 3.6);

/**
 * Keeps the screen from turning off, where the browser can. Android Chrome
 * can; a browser that cannot returns null, and the screen has to be kept on by
 * hand.
 */
export async function keepScreenOn(): Promise<WakeLockSentinel | null> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    // Refused, say on low battery: sharing still works while the screen is on.
    return null;
  }
}
