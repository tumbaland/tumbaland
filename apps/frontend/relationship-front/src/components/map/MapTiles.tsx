import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { loadMapLibre } from './loadMapLibre';

/**
 * OpenFreeMap's Liberty style: OpenStreetMap's data drawn as a vector map,
 * softer and clearer than the stock tiles. Free, with no key and no quota.
 * Attribution to all three is required.
 */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** The stock tiles, for a phone that cannot draw the vector map (no WebGL) or could not load it. */
export const FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Closest the map goes: a vector map stays sharp past the tiles it has, to street level and a bit. */
const MAX_ZOOM = 19;

/**
 * The map's background, as a layer in the Leaflet map, so the markers, taps
 * and following on top stay Leaflet's. Drawn by MapLibre once it has loaded;
 * the stock tiles where it cannot be.
 */
export function MapTiles() {
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(MAX_ZOOM);
    let layer: L.Layer | null = null;
    let gone = false;
    const fallBack = () => {
      if (gone) return;
      layer = L.tileLayer(FALLBACK_TILE_URL, { attribution: FALLBACK_ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map);
    };
    loadMapLibre()
      .then((maplibreGL) => {
        if (gone) return;
        try {
          layer = maplibreGL({ style: MAP_STYLE, attributionControl: { customAttribution: MAP_ATTRIBUTION } }).addTo(
            map
          );
        } catch {
          // No WebGL: MapLibre refuses to start.
          layer = null;
          fallBack();
        }
      })
      .catch(fallBack);
    return () => {
      gone = true;
      layer?.remove();
    };
  }, [map]);
  return null;
}
