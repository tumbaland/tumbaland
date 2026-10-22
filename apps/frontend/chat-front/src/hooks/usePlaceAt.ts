import { useEffect, useState } from 'react';
import { chatApi } from '../services/chatApi';
import type { PlaceResult } from '../types';

/** Long enough that a dot being dragged is asked about once it settles, not on every step. */
const SETTLE_MS = 600;

/** Addresses already asked for, by point to about a metre, for this page's life. */
const known = new Map<string, PlaceResult | null>();
const keyOf = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export function forgetPlaces(): void {
  known.clear();
}

/**
 * The address at a point, once the point has stopped moving: "Viru 4,
 * Tallinn". Undefined while asking, null when there is none to give (out at
 * sea, or the geocoder down), and nothing is asked for no point.
 */
export function usePlaceAt(point: { lat: number; lng: number } | null): PlaceResult | null | undefined {
  const key = point ? keyOf(point.lat, point.lng) : null;
  const [found, setFound] = useState<{ key: string; place: PlaceResult | null } | null>(null);

  useEffect(() => {
    if (!key || !point) return;
    if (known.has(key)) {
      setFound({ key, place: known.get(key)! });
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      chatApi
        .placeAt(point.lat, point.lng)
        .then((place) => {
          known.set(key, place);
          if (live) setFound({ key, place });
        })
        .catch(() => {
          // A temporary network/rate-limit failure must not become a permanent missing address.
          if (live) setFound({ key, place: null });
        });
    }, SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Keyed on the point to a metre, not on the object passed in each render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  return found?.key === key ? found.place : undefined;
}

/** "Viru 4, Tallinn", or the coordinates when there is no address to give. */
export function placeText(place: PlaceResult | null | undefined, point: { lat: number; lng: number }): string {
  if (place) return [place.name, place.detail.split(', ')[0]].filter(Boolean).join(', ');
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
