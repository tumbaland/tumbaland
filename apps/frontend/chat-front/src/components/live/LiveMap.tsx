import { Fragment, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { Circle, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { ensureLeafletStyles } from './leafletStyles';
import { LiveMapMarker } from './LiveMapMarker';

/** OpenStreetMap's tiles, as the journal's map uses them. Attribution is required by its usage policy. */
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Close enough to read the streets around a car. */
const ZOOM = 15;

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** Metres. Drawn as a faint circle when it says something (a few km of it says nothing). */
  accuracy?: number | null;
  color: string;
  label: string;
  /** A person is a dot; a place is a pin standing on its point. */
  kind?: 'person' | 'place';
  /** Makes it draggable: where it was dropped. */
  onMove?: (point: { lat: number; lng: number }) => void;
  /** A tap on it, such as taking a destination away. It does not reach the map beneath. */
  onClick?: () => void;
}

export interface LiveMapProps {
  points: MapPoint[];
  /**
   * Keeps everyone on the map in view as they move, until someone drags it.
   * Off for a map being tapped to mark a place: it must stay where it is put.
   */
  follow?: boolean;
  /** A tap on the map, for marking a place. */
  onMapClick?: (point: { lat: number; lng: number }) => void;
  /** A place to bring into view, such as one picked from search. A new `key` goes there again. */
  focus?: { lat: number; lng: number; key: number } | null;
}

/** Where every point is, as one key, so the view moves only when one of them does. */
const placesKey = (points: MapPoint[]) => points.map((point) => `${point.lat},${point.lng}`).join('|');

/**
 * Keeps the points in view: centred on one, or all of them fitted in, so a
 * car and where it is going are both on screen and the map closes in as they
 * near each other. A drag hands the map over to the person.
 */
function Follow({
  points,
  following,
  focus,
  onDrag,
  onClick
}: {
  points: MapPoint[];
  following: boolean;
  focus: LiveMapProps['focus'];
  onDrag: () => void;
  onClick?: LiveMapProps['onMapClick'];
}) {
  const map = useMap();
  const interacted = useRef(false);
  const positioned = useRef(points.length > 0);
  useMapEvents({
    dragstart: () => {
      interacted.current = true;
      onDrag();
    },
    click: (event) => {
      interacted.current = true;
      onClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  const key = placesKey(points);
  useEffect(() => {
    if (points.length === 0) return;
    const firstPosition = !positioned.current;
    positioned.current = true;
    if (!following && (!firstPosition || interacted.current)) return;
    if (points.length === 1)
      map.setView([points[0]!.lat, points[0]!.lng], firstPosition ? ZOOM : map.getZoom(), { animate: true });
    else
      map.fitBounds(
        points.map((point) => [point.lat, point.lng] as [number, number]),
        { padding: [48, 48], maxZoom: ZOOM }
      );
  }, [map, following, key]); // oxlint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), ZOOM), { animate: true });
  }, [map, focus?.key]); // oxlint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * A map of where people are, and the places that matter to it. Loaded only
 * when opened, so Leaflet is not part of every chat.
 */
export default function LiveMap({ points, follow = true, onMapClick, focus = null }: LiveMapProps) {
  ensureLeafletStyles();
  const [following, setFollowing] = useState(follow);
  useEffect(() => setFollowing(follow), [follow]);
  const first = points[0];

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        '& .leaflet-container': { width: '100%', height: '100%', cursor: onMapClick ? 'crosshair' : undefined },
        '& .tumbaland-live-dot, & .tumbaland-live-pin': { background: 'none', border: 'none' }
      }}
    >
      <MapContainer center={first ? [first.lat, first.lng] : [20, 0]} zoom={first ? ZOOM : 2} attributionControl>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {points.map((point) => (
          <Fragment key={point.id}>
            {point.accuracy && point.accuracy > 15 && point.accuracy < 2000 ? (
              <Circle
                center={[point.lat, point.lng]}
                radius={point.accuracy}
                pathOptions={{ color: point.color, weight: 1, fillOpacity: 0.12 }}
              />
            ) : null}
            <LiveMapMarker point={point} />
          </Fragment>
        ))}
        <Follow
          points={points}
          following={following}
          focus={focus}
          onDrag={() => setFollowing(false)}
          onClick={onMapClick}
        />
      </MapContainer>
      {follow && !following && (
        <Button
          variant="contained"
          size="small"
          startIcon={<MyLocationIcon />}
          onClick={() => setFollowing(true)}
          sx={{ position: 'absolute', right: 12, bottom: 24, zIndex: 1000 }}
        >
          Follow
        </Button>
      )}
    </Box>
  );
}
