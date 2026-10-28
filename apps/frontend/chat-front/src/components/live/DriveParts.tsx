import { Suspense, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { ink, surface } from '@tumbaland/frontend-core';
import { DESTINATION_COLOR, distanceBetween, formatDistance } from '../../services/live';
import type { LiveShare, SavedPlace } from '../../types';
import type { MapPoint } from './LiveMap';

/** The map, or what stands in for it until there is a position to show. */
export function MapArea({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ flex: 1, minHeight: 220, position: 'relative', bgcolor: surface.sunken }}>
      <Suspense
        fallback={
          <Centred>
            <CircularProgress />
          </Centred>
        }
      >
        {children}
      </Suspense>
    </Box>
  );
}

export function Centred({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', gap: 1, height: '100%', p: 2, textAlign: 'center' }}>
      {children}
    </Box>
  );
}

export const destinationPoint = (
  destination: { lat: number; lng: number; label?: string | null },
  extra: Partial<MapPoint> = {}
): MapPoint => ({
  id: 'destination',
  lat: destination.lat,
  lng: destination.lng,
  color: DESTINATION_COLOR,
  label: destination.label || 'Destination',
  kind: 'place',
  ...extra
});

/** Who is waiting, and how close the sharer is to telling them. */
export function Watchers({ share }: { share: LiveShare | null }) {
  return (
    <>
      {share?.watchers.map((watcher) => (
        <Typography key={watcher.userId} variant="body2" sx={{ color: ink.muted }}>
          {watcher.notified
            ? `${watcher.name} has been told you are close`
            : `${watcher.name} is told at ${formatDistance(watcher.radiusM)}${
                watcher.distanceM !== null ? ` · ${formatDistance(watcher.distanceM)} away` : ''
              }`}
        </Typography>
      ))}
    </>
  );
}

/** The saved place at a point, if there is one: "Home". */
export const savedAt = (places: SavedPlace[], point: { lat: number; lng: number } | null) =>
  point ? places.find((place) => distanceBetween(place, point) < 30) : undefined;
