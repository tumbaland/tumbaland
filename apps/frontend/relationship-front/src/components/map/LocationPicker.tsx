import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, Button, CircularProgress, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import { MapContainer, Marker, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent, Marker as LeafletMarker } from 'leaflet';
import { ensureLeafletStyles } from './leafletStyles';
import { ActivityLocation, Place } from '../../services/types';
import { GeocodeResult, searchPlaces } from '../../services/geocoding';
import { MapTiles } from './MapTiles';
import { PLACE_ZOOM, WORLD_CENTER, WORLD_ZOOM, pinIcon } from './mapConfig';

// The stylesheet has to reach the shell's document too; see leafletStyles.
ensureLeafletStyles();

/** An option in the dropdown: a place already visited, or a geocoder hit. */
interface PickerOption {
  label: string;
  lat: number;
  lng: number;
  detail: string;
  /** true for places already in the journal — these sort first */
  saved: boolean;
}

interface LocationPickerProps {
  value: ActivityLocation | null;
  onChange: (location: ActivityLocation | null) => void;
  /** places already visited in this scope, offered before any network lookup */
  savedPlaces: Place[];
  /** accessible name, e.g. "Restaurants — place" */
  label?: string;
}

const SEARCH_DEBOUNCE_MS = 400;

/** Moves the pin when the map is clicked. */
const ClickToPlace: React.FC<{ onPick: (lat: number, lng: number) => void }> = ({ onPick }) => {
  useMapEvents({
    click: (event: LeafletMouseEvent) => onPick(event.latlng.lat, event.latlng.lng)
  });
  return null;
};

/**
 * Picks where an entry happened: search a place by name, or drag the pin.
 *
 * Places already in the journal are matched locally and shown first, so
 * revisiting somewhere never touches the geocoder. Only an explicit search of
 * 3+ characters reaches Nominatim, debounced and aborted on each keystroke.
 */
const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, savedPlaces, label }) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const savedOptions = useMemo<PickerOption[]>(
    () =>
      savedPlaces.map((place) => ({
        label: place.label,
        lat: place.lat,
        lng: place.lng,
        detail: `${place.visits} visit${place.visits === 1 ? '' : 's'} · last ${place.lastVisit}`,
        saved: true
      })),
    [savedPlaces]
  );

  // Saved places that match what's typed, then geocoder hits that aren't
  // already covered by a saved place at the same spot.
  const options = useMemo<PickerOption[]>(() => {
    const needle = input.trim().toLowerCase();
    const matchingSaved = needle
      ? savedOptions.filter((option) => option.label.toLowerCase().includes(needle))
      : savedOptions;

    const savedKeys = new Set(matchingSaved.map((o) => `${o.lat.toFixed(4)},${o.lng.toFixed(4)}`));
    const geocoded = results
      .filter((hit) => !savedKeys.has(`${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}`))
      .map((hit) => ({ ...hit, saved: false }));

    return [...matchingSaved, ...geocoded];
  }, [input, savedOptions, results]);

  // Debounced geocoder lookup; each keystroke aborts the request in flight.
  useEffect(() => {
    const query = input.trim();
    if (query.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      searchPlaces(query, { signal: controller.signal })
        .then((hits) => {
          if (!controller.signal.aborted) setResults(hits);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [input]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const movePin = useCallback(
    (lat: number, lng: number) => {
      onChange({ label: value?.label?.trim() || 'Dropped pin', lat, lng });
    },
    [onChange, value?.label]
  );

  const center: [number, number] = value
    ? [value.lat, value.lng]
    : savedPlaces.length > 0
      ? [savedPlaces[0].lat, savedPlaces[0].lng]
      : WORLD_CENTER;
  const zoom = value || savedPlaces.length > 0 ? PLACE_ZOOM : WORLD_ZOOM;
  const showMap = mapOpen || value !== null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Autocomplete<PickerOption, false, false, true>
          freeSolo
          fullWidth
          size="small"
          options={options}
          filterOptions={(all) => all} // already filtered above; keep geocoder hits visible
          inputValue={input}
          loading={searching}
          onInputChange={(_, next, reason) => {
            if (reason !== 'reset') setInput(next);
          }}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
          isOptionEqualToValue={(option, selected) =>
            typeof option !== 'string' &&
            typeof selected !== 'string' &&
            option.lat === selected.lat &&
            option.lng === selected.lng
          }
          onChange={(_, selected) => {
            if (!selected || typeof selected === 'string') return;
            onChange({ label: selected.label, lat: selected.lat, lng: selected.lng });
            setInput('');
          }}
          renderOption={(props, option) => {
            const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
            return (
              <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                {option.saved ? (
                  <HistoryIcon fontSize="small" sx={{ mt: 0.25, color: 'primary.main' }} />
                ) : (
                  <PlaceIcon fontSize="small" sx={{ mt: 0.25, color: 'text.disabled' }} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: option.saved ? 600 : 400 }}>
                    {option.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                    {option.detail}
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label ?? 'Place'}
              placeholder={value ? value.label : 'Search a place, or drop a pin'}
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  startAdornment: <PlaceIcon fontSize="small" sx={{ color: 'text.disabled', mr: 0.5 }} />,
                  endAdornment: (
                    <>
                      {searching ? <CircularProgress size={16} /> : null}
                      {params.slotProps.input.endAdornment}
                    </>
                  )
                }
              }}
            />
          )}
        />
        {value && (
          <Tooltip title="Remove this place">
            <IconButton
              size="small"
              aria-label="Remove this place"
              onClick={() => {
                onChange(null);
                setMapOpen(false);
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {value && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {value.label} · {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
        </Typography>
      )}

      {!showMap ? (
        <Button
          size="small"
          startIcon={<PlaceIcon />}
          onClick={() => setMapOpen(true)}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          Drop a pin on the map
        </Button>
      ) : (
        <Box
          sx={{
            height: 180,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            '& .leaflet-container': { height: '100%', width: '100%' }
          }}
        >
          <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} attributionControl>
            <MapTiles />
            <ClickToPlace onPick={movePin} />
            {value && (
              <Marker
                position={[value.lat, value.lng]}
                icon={pinIcon()}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const { lat, lng } = (event.target as LeafletMarker).getLatLng();
                    movePin(lat, lng);
                  }
                }}
              />
            )}
          </MapContainer>
        </Box>
      )}

      {showMap && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Click the map to place the pin, or drag it to adjust.
        </Typography>
      )}
    </Box>
  );
};

export default LocationPicker;
