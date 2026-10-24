import L from 'leaflet';

/** World view, used when a scope has no places to centre on yet. */
export const WORLD_CENTER: [number, number] = [20, 0];
export const WORLD_ZOOM = 2;
/** Zoom used when focusing a single known place. */
export const PLACE_ZOOM = 15;

const DEFAULT_PIN_COLOR = '#9e9e9e';

/**
 * A pin drawn as inline SVG in a `divIcon`.
 *
 * Leaflet's stock marker loads its icon from a bundled image path that breaks
 * under Vite; drawing the pin ourselves sidesteps that entirely and lets the
 * pin carry the activity type's own colour and a visit count.
 */
export const pinIcon = (color?: string, count?: number): L.DivIcon => {
  const fill = color || DEFAULT_PIN_COLOR;
  const badge =
    count && count > 1
      ? `<span style="position:absolute;top:-4px;right:-6px;min-width:16px;height:16px;padding:0 3px;
           border-radius:8px;background:#fff;color:#222;border:1px solid ${fill};
           font:600 10px/16px system-ui,sans-serif;text-align:center;box-sizing:border-box">${
             count > 99 ? '99+' : count
           }</span>`
      : '';

  return L.divIcon({
    className: 'tumbaland-pin',
    html: `<div style="position:relative;width:24px;height:32px">
      <svg width="24" height="32" viewBox="0 0 24 32" aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z"
              fill="${fill}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
        <circle cx="12" cy="12" r="4.5" fill="#fff"/>
      </svg>${badge}
    </div>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -30]
  });
};
