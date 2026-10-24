import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CloseIcon from '@mui/icons-material/Close';
import { ink, surface } from '@tumbaland/frontend-core';
import { chatApi } from '../../services/chatApi';
import type { PlaceResult, SavedPlace } from '../../types';

/** One line of the search's list. */
export interface PlaceOption {
  key: string;
  group: string;
  name: string;
  detail: string;
  /** Absent for "Your location", which the field's owner resolves. */
  lat?: number;
  lng?: number;
}

export interface PlaceFieldProps {
  /** "From" or "To", read out with the row. */
  label: string;
  /** The row's main line: "Your location", "Home", "Where to?". */
  primary: string;
  /** The address under it, when there is one. */
  secondary?: string | null;
  color: string;
  /** Whether a place is set. A row with nothing in it offers search and nothing else. */
  filled: boolean;
  /** Already one of the saved places: its bookmark is filled and does nothing. */
  saved?: boolean;
  savedPlaces: SavedPlace[];
  /** Offered first, before saved places: "Your location". */
  extraOptions?: PlaceOption[];
  /** Search results come nearest to here first. */
  near?: { lat: number; lng: number } | null;
  /** Opens the search straight away, for an empty "Where to?" a tap should go into. */
  startSearching?: boolean;
  /** Controlled by the map picker so a map click can finish this field's selection. */
  searching?: boolean;
  onSearchingChange?: (searching: boolean) => void;
  /** The field a map click will change, retained when its search box loses focus. */
  active?: boolean;
  onPick: (option: PlaceOption) => void;
  onSave?: () => void;
  onClear?: () => void;
}

/** Long enough to type a word between lookups. */
const TYPE_PAUSE_MS = 300;

const fromSaved = (place: SavedPlace): PlaceOption => ({
  key: `saved-${place.id}`,
  group: 'Saved',
  name: place.name,
  detail: place.address,
  lat: place.lat,
  lng: place.lng
});

const fromFound = (place: PlaceResult, index: number): PlaceOption => ({
  key: `found-${index}-${place.lat},${place.lng}`,
  group: 'Places',
  name: place.name,
  detail: place.detail,
  lat: place.lat,
  lng: place.lng
});

/**
 * A "From" or "To" line under the map, as a route planner has them: the
 * place and its address, and a tap to search instead, with saved places
 * offered before anything found.
 */
export function PlaceField({
  label,
  primary,
  secondary,
  color,
  filled,
  saved = false,
  savedPlaces,
  extraOptions = [],
  near = null,
  startSearching = false,
  searching: controlledSearching,
  onSearchingChange,
  active = false,
  onPick,
  onSave,
  onClear
}: PlaceFieldProps) {
  const [localSearching, setLocalSearching] = useState(startSearching);
  const searching = controlledSearching ?? localSearching;
  const setSearching = (next: boolean) => {
    if (controlledSearching === undefined) setLocalSearching(next);
    onSearchingChange?.(next);
  };
  const [text, setText] = useState('');
  const [found, setFound] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!searching) setText('');
  }, [searching]);

  useEffect(() => {
    const query = text.trim();
    setFound([]);
    if (!searching || query.length < 2) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void chatApi
        .searchPlaces(query, near)
        .catch(() => [])
        .then((results) => {
          if (!live) return;
          setFound(results);
          setLoading(false);
        });
    }, TYPE_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Near is only a bias; a new search for each step of a moving dot is not worth it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [text, searching]);

  if (searching) {
    const typed = text.trim().toLowerCase();
    const savedOptions = savedPlaces
      .filter(
        (place) => !typed || place.name.toLowerCase().includes(typed) || place.address.toLowerCase().includes(typed)
      )
      .map(fromSaved);
    const options = [...(typed ? [] : extraOptions), ...savedOptions, ...found.map(fromFound)];

    return (
      <Autocomplete<PlaceOption>
        open
        autoHighlight
        options={options}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.key === value.key}
        // The service did the matching; saved places were matched above.
        filterOptions={(all) => all}
        loading={loading}
        loadingText="Looking"
        noOptionsText={typed.length < 2 ? 'Type a place or an address' : 'Nothing found'}
        inputValue={text}
        onInputChange={(_, value) => setText(value)}
        onChange={(_, option) => {
          if (!option) return;
          onPick(option);
          setSearching(false);
          setText('');
        }}
        onClose={(_, reason) => {
          if (reason === 'escape' || reason === 'blur') {
            setSearching(false);
            setText('');
          }
        }}
        renderOption={({ key, ...props }, option) => (
          <Box component="li" key={key} {...props}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
              {option.detail && (
                <Typography variant="caption" noWrap sx={{ display: 'block', color: ink.muted }}>
                  {option.detail}
                </Typography>
              )}
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField {...params} autoFocus size="small" label={label} placeholder="Search a place or an address" />
        )}
      />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: 2,
        bgcolor: surface.sunken,
        pr: 0.5,
        outline: active ? `2px solid ${color}` : undefined
      }}
    >
      <ButtonBase
        onClick={() => setSearching(true)}
        aria-label={`${label}: ${primary}${secondary ? `, ${secondary}` : ''}. Change`}
        sx={{
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
          gap: 1.25,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          textAlign: 'left'
        }}
      >
        <Box aria-hidden sx={{ flexShrink: 0, width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ display: 'block', color: ink.muted, lineHeight: 1.2 }}>
            {label}
          </Typography>
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: filled ? 600 : 400, color: filled ? ink.body : ink.muted }}
          >
            {primary}
          </Typography>
          {secondary && (
            <Typography variant="caption" noWrap sx={{ display: 'block', color: ink.muted }}>
              {secondary}
            </Typography>
          )}
        </Box>
      </ButtonBase>
      {filled && onSave && (
        <Tooltip title={saved ? 'Saved' : 'Save this place'}>
          <span>
            <IconButton size="small" aria-label={saved ? 'Saved' : 'Save this place'} disabled={saved} onClick={onSave}>
              {saved ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {filled && onClear && (
        <IconButton size="small" aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear}>
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}
