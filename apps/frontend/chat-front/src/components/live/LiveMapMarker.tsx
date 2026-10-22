import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { MapPoint } from './LiveMap';

function iconFor(color: string, place: boolean, draggable: boolean) {
  return L.divIcon(
    place
      ? {
          className: 'tumbaland-live-pin',
          html: `<svg width="28" height="38" viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z"
            fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
      <circle cx="12" cy="12" r="4.5" fill="#fff"/>
    </svg>`,
          iconSize: [28, 38],
          iconAnchor: [14, 38],
          tooltipAnchor: [0, -38]
        }
      : {
          className: 'tumbaland-live-dot',
          html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4);box-sizing:border-box;cursor:${draggable ? 'grab' : 'default'}"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          tooltipAnchor: [0, -12]
        }
  );
}

/** A clock tick must not set the old position or replace the icon during a drag. */
export function LiveMapMarker({ point }: { point: MapPoint }) {
  const { lat, lng, color, kind, onMove, onClick, label } = point;
  const draggable = Boolean(onMove);
  const position = useMemo<L.LatLngTuple>(() => [lat, lng], [lat, lng]);
  const icon = useMemo(() => iconFor(color, kind === 'place', draggable), [color, kind, draggable]);
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
