import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { MapPoint } from './LiveMap';

const PHOTO = 44;
const POINTER = 8;
const STALE_COLOR = '#9e9e9e';

/**
 * A person as their photo in a ring of their colour, with a pointer to the
 * spot. Built from elements rather than a string because the picture's address
 * comes from a profile. Their initial sits under the photo, so it shows until
 * the picture arrives and stays if it never does.
 */
function photoIcon({ color, picture, initial, stale }: PersonLook, draggable: boolean) {
  const ring = stale ? STALE_COLOR : color;
  const root = document.createElement('div');
  root.style.cssText = `position:relative;width:${PHOTO}px;height:${PHOTO + POINTER}px;cursor:${
    draggable ? 'grab' : 'default'
  };${stale ? 'opacity:.65;filter:grayscale(1);' : ''}`;

  const disc = document.createElement('div');
  disc.style.cssText = `position:relative;width:${PHOTO}px;height:${PHOTO}px;border-radius:50%;overflow:hidden;
    background:${ring};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45),0 0 0 2px ${ring};box-sizing:border-box;
    display:grid;place-items:center;color:#fff;font:600 18px/1 system-ui,sans-serif`;
  disc.textContent = initial;
  if (picture) {
    const image = document.createElement('img');
    image.src = picture;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.draggable = false;
    image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
    image.onerror = () => image.remove();
    disc.appendChild(image);
  }

  const pointer = document.createElement('div');
  pointer.style.cssText = `position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;
    border-left:7px solid transparent;border-right:7px solid transparent;border-top:${POINTER + 1}px solid ${ring}`;
  root.append(disc, pointer);

  return L.divIcon({
    className: 'tumbaland-live-photo',
    html: root,
    iconSize: [PHOTO, PHOTO + POINTER],
    iconAnchor: [PHOTO / 2, PHOTO + POINTER],
    tooltipAnchor: [0, -(PHOTO + POINTER)]
  });
}

function pinIcon(color: string) {
  return L.divIcon({
    className: 'tumbaland-live-pin',
    html: `<svg width="28" height="38" viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z"
            fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
      <circle cx="12" cy="12" r="4.5" fill="#fff"/>
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    tooltipAnchor: [0, -38]
  });
}

interface PersonLook {
  color: string;
  picture: string | null;
  initial: string;
  stale: boolean;
}

/** A clock tick must not set the old position or replace the icon during a drag. */
export function LiveMapMarker({ point }: { point: MapPoint }) {
  const { lat, lng, color, kind, onMove, onClick, label, picture = null, initial = '', stale = false } = point;
  const draggable = Boolean(onMove);
  const position = useMemo<L.LatLngTuple>(() => [lat, lng], [lat, lng]);
  const icon = useMemo(
    () => (kind === 'place' ? pinIcon(color) : photoIcon({ color, picture, initial, stale }, draggable)),
    [color, kind, picture, initial, stale, draggable]
  );
  const callbacks = useRef({ onMove, onClick });
  useEffect(() => {
    callbacks.current = { onMove, onClick };
  }, [onMove, onClick]);
  const events = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({
      dragend: (event: L.DragEndEvent) => {
        const at = (event.target as L.Marker).getLatLng();
        callbacks.current.onMove?.({ lat: at.lat, lng: at.lng });
      },
      click: () => callbacks.current.onClick?.()
    }),
    []
  );
  return (
    <Marker position={position} icon={icon} draggable={draggable} eventHandlers={events}>
      <Tooltip permanent direction="top">
        {label}
      </Tooltip>
    </Marker>
  );
}
