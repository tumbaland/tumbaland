import type { maplibreGL } from '@maplibre/maplibre-gl-leaflet';

const STYLE_MARKER = 'data-maplibre-styles';

let pending: Promise<typeof maplibreGL> | null = null;

/**
 * MapLibre and its Leaflet bridge, fetched with the first map rather than with
 * the app: together they are most of a megabyte.
 *
 * Its worker is a file of its own. Vite emits it and hands back a path from
 * this app's root, which framed by the shell would resolve against the shell's
 * origin, so it is resolved against this chunk's own address instead, as the
 * config file is. MapLibre wraps a worker from another origin itself.
 *
 * The stylesheet travels as a string for the reason Leaflet's does (see
 * `leafletStyles`): a remote's CSS file is never linked inside the shell.
 */
export function loadMapLibre(): Promise<typeof maplibreGL> {
  if (!pending)
    pending = Promise.all([
      import('maplibre-gl'),
      import('@maplibre/maplibre-gl-leaflet'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css?inline')
    ])
      .then(([maplibre, bridge, worker, css]) => {
        maplibre.setWorkerUrl(new URL(worker.default, import.meta.url).href);
        if (typeof document !== 'undefined' && !document.querySelector(`style[${STYLE_MARKER}]`)) {
          const style = document.createElement('style');
          style.setAttribute(STYLE_MARKER, '');
          style.textContent = css.default;
          document.head.appendChild(style);
        }
        return bridge.maplibreGL;
      })
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  return pending;
}
