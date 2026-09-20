import leafletCss from 'leaflet/dist/leaflet.css?inline';

/**
 * Leaflet's stylesheet, carried in the JavaScript that needs it.
 *
 * It used to be a side-effect import — `import 'leaflet/dist/leaflet.css'` —
 * which works everywhere except the one place the map actually runs. Every
 * front builds with `cssCodeSplit: false`, so all of an app's CSS is emitted
 * as a single `style.css` that its own `index.html` links. Standalone that is
 * fine. Loaded into shell-front as a module-federation remote, only
 * `remoteEntry.js` and its chunks are fetched and nothing ever links that file,
 * so Leaflet ran with no stylesheet at all: tiles are laid out by
 * `.leaflet-tile { position: absolute }`, and without it they fall back into
 * normal flow and land wherever their transforms drop them. The scattered
 * squares, the missing zoom control and the missing pins were all the one
 * absent file.
 *
 * `?inline` hands us the compiled CSS as a string instead of emitting a file,
 * so it travels inside the chunk that imports it and arrives wherever that
 * chunk is executed — dev, standalone, or framed by the shell.
 *
 * The `url()`s inside it point at Leaflet's own marker images, which resolve
 * against this app's origin and which nothing here uses: every pin on both
 * maps is an inline-SVG `divIcon` (see `mapConfig`).
 */
const STYLE_MARKER = 'data-leaflet-styles';

let injected = false;

/** Adds the stylesheet to the document once, however many maps ask for it. */
export function ensureLeafletStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;

  // A second copy would be harmless but is worth avoiding: standalone the app
  // may already carry it in its own stylesheet, and both maps call this.
  if (document.querySelector(`style[${STYLE_MARKER}]`)) return;

  const style = document.createElement('style');
  style.setAttribute(STYLE_MARKER, '');
  style.textContent = leafletCss;
  document.head.appendChild(style);
}

export default ensureLeafletStyles;
