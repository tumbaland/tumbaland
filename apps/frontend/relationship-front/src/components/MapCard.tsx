import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, CircularProgress, MenuItem, TextField, Typography } from '@mui/material';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ensureLeafletStyles } from './map/leafletStyles';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { logger } from '@tumbaland/frontend-core';
import { ActivityType, Place } from '../services/types';
import { getPlaces } from '../services/places';
import { getActivityTypes } from '../services/activityTypes';
import { PLACE_ZOOM, TILE_ATTRIBUTION, TILE_URL, WORLD_CENTER, WORLD_ZOOM, pinIcon } from './map/mapConfig';
import PlacePopup from './map/PlacePopup';
import { localDayKey } from '../utils/dates';

// The stylesheet has to reach the shell's document too; see leafletStyles.
ensureLeafletStyles();

/**
 * Keeps the viewport on the current set of pins as filters change.
 *
 * Every fit is preceded by `invalidateSize`. Leaflet measures its container
 * once, when the map is created, and caches that size; it then converts
 * lat/lng to pixels against it. Inside the shell the map is created while the
 * module is still being laid out, so the size it caught was wrong or zero, and
 * everything derived from it was wrong with it — the fit resolved against a
 * box of the wrong shape, so the view landed somewhere else and the pins,
 * positioned against the same stale size, sat outside the visible area. That
 * is one bug with two faces: a map that does not fit, and pins that are not
 * on it.
 */
const FitToPlaces: React.FC<{ places: Place[] }> = ({ places }) => {
  const map = useMap();

  useEffect(() => {
    // The container is still being sized on the frame the map is created in,
    // so remeasure once the browser has laid it out rather than right now.
    const remeasure = () => map.invalidateSize({ animate: false });
    const frame = requestAnimationFrame(remeasure);

    // And again whenever the box changes: rotating a phone, opening the rail,
    // or the window being resized all leave the cached size stale.
    const observer = new ResizeObserver(remeasure);
    observer.observe(map.getContainer());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (places.length === 0) return;

    const fit = () => {
      map.invalidateSize({ animate: false });
      if (places.length === 1) {
        map.setView([places[0].lat, places[0].lng], PLACE_ZOOM);
        return;
      }
      map.fitBounds(L.latLngBounds(places.map((place) => [place.lat, place.lng] as [number, number])), {
        padding: [48, 48],
        maxZoom: PLACE_ZOOM
      });
    };

    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [map, places]);

  return null;
};

const thisYear = new Date().getFullYear();

interface RangeOption {
  value: string;
  label: string;
  range: () => { startDate?: string; endDate?: string };
}

const rangeOptions: RangeOption[] = [
  { value: 'all', label: 'All time', range: () => ({}) },
  {
    value: 'year',
    label: 'This year',
    range: () => ({ startDate: `${thisYear}-01-01`, endDate: `${thisYear}-12-31` })
  },
  {
    value: 'last-year',
    label: 'Last year',
    range: () => ({ startDate: `${thisYear - 1}-01-01`, endDate: `${thisYear - 1}-12-31` })
  },
  {
    value: '90d',
    label: 'Last 90 days',
    range: () => {
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return { startDate: localDayKey(start) };
    }
  }
];

/**
 * Everywhere you've been together, as a card among the dashboard's figures.
 * One pin per place, sized by visit count and coloured by the activity type
 * logged there most often; the popup lists the individual visits and links
 * into that day in the journal.
 */
const MapCard: React.FC = () => {
  const tenantGroupId = useTenantFilter();

  const [places, setPlaces] = useState<Place[]>([]);
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [rangeFilter, setRangeFilter] = useState('all');

  useEffect(() => {
    getActivityTypes({ groupId: tenantGroupId })
      .then((response) => setTypes(response.data.filter((type) => type.hasLocation)))
      .catch((e) => logger.error('Failed to load activity types', e));
  }, [tenantGroupId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = rangeOptions.find((option) => option.value === rangeFilter)?.range() ?? {};
      setPlaces(
        await getPlaces({
          groupId: tenantGroupId,
          typeId: typeFilter || undefined,
          ...range
        })
      );
    } catch (e) {
      logger.error('Failed to load places', e);
      setError('Failed to load the map');
    } finally {
      setLoading(false);
    }
  }, [tenantGroupId, typeFilter, rangeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalVisits = useMemo(() => places.reduce((sum, place) => sum + place.visits, 0), [places]);

  const initialCenter: [number, number] = places.length > 0 ? [places[0].lat, places[0].lng] : WORLD_CENTER;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          // Stacked at every width: the card is half a screen on desktop, too
          // narrow for the title and both filters on one row.
          flexDirection: 'column',
          gap: { xs: 1.5, sm: 2 },
          mb: { xs: 1.5, sm: 3 }
        }}
      >
        <Box>
          <Typography
            variant="h5"
            component="h2"
            sx={{ fontWeight: 'bold', color: 'text.primary', fontSize: { xs: '1.1rem', sm: '1.5rem' } }}
          >
            Map
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {places.length > 0
              ? `${places.length} place${places.length === 1 ? '' : 's'} · ${totalVisits} visit${
                  totalVisits === 1 ? '' : 's'
                }`
              : 'Everywhere you have been together'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            select
            size="small"
            label="Activity"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            sx={{ minWidth: 0, flex: 1 }}
          >
            <MenuItem value="">All activities</MenuItem>
            {types.map((type) => (
              <MenuItem key={type._id} value={type._id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: type.color || '#9e9e9e' }} />
                  {type.name}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="When"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
            sx={{ minWidth: 0, flex: 1 }}
          >
            {rangeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </Box>
      ) : places.length === 0 ? (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Typography variant="h6" sx={{ color: 'text.secondary' }} gutterBottom>
              {typeFilter || rangeFilter !== 'all' ? 'No places match these filters' : 'No places logged yet'}
            </Typography>
            {!typeFilter && rangeFilter === 'all' && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Turn on “Track where it happened” for an activity type, then add a place when you log a day.
              </Typography>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Box
            sx={{
              // Shorter than the full page it used to be: it is one card among
              // several, and a phone has to scroll past it to reach the rest.
              height: { xs: 320, md: 360 },
              borderRadius: 3,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              '& .leaflet-container': { height: '100%', width: '100%' }
            }}
          >
            <MapContainer
              center={initialCenter}
              zoom={places.length > 0 ? PLACE_ZOOM : WORLD_ZOOM}
              // Sized here as well as by the rule above: the map has to have a
              // box before Leaflet measures it, and a descendant selector that
              // loses to anything is a map of zero height.
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <FitToPlaces places={places} />
              {places.map((place) => (
                <Marker
                  key={place.id}
                  position={[place.lat, place.lng]}
                  icon={pinIcon(place.types[0]?.color, place.visits)}
                >
                  <Popup>
                    <PlacePopup place={place} groupId={tenantGroupId} />
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
            {places.slice(0, 8).map((place) => (
              <Chip
                key={place.id}
                size="small"
                variant="outlined"
                label={`${place.label} · ${place.visits}`}
                sx={{ borderColor: place.types[0]?.color || 'divider' }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default MapCard;
