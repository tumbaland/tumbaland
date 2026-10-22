import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CloseIcon from '@mui/icons-material/Close';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import type { UseDriveShareResult } from '../../hooks/useDriveShare';
import { placeText, usePlaceAt } from '../../hooks/usePlaceAt';
import { chatApi } from '../../services/chatApi';
import {
  DESTINATION_COLOR,
  PERSON_COLOR,
  STALE_MS,
  ageText,
  currentPosition,
  distanceBetween,
  formatDistance,
  kmh
} from '../../services/live';
import type { LiveShare, PickedPlace, SavedPlace } from '../../types';
import type { MapPoint } from './LiveMap';
import { PlaceField, type PlaceOption } from './PlaceField';
import { SavePlaceDialog } from './SavePlaceDialog';
import { useNow } from './useNow';
import { loadLiveMap } from './loadLiveMap';

const LiveMap = lazy(loadLiveMap);

export interface DriveScreenProps {
  open: boolean;
  /** Hides the screen. Sharing goes on while the conversation stays open. */
  onClose: () => void;
  conversationId: string;
  drive: UseDriveShareResult;
  /** The caller's own share, as the server has it: there after a reload even before sending resumes. */
  share: LiveShare | null;
  /** Who will see it: "Irja". */
  audience: string;
}

/** A browser's guess worse than this is likely a computer guessing from its connection. */
const ROUGH_GUESS_M = 1000;

/** The "From" line's own choice: wherever the phone says it is. */
const YOUR_LOCATION: PlaceOption = {
  key: 'gps',
  group: 'Here',
  name: 'Your location',
  detail: 'Where this phone says you are'
};

/** The map, or what stands in for it until there is a position to show. */
function MapArea({ children }: { children: ReactNode }) {
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

function Centred({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', gap: 1, height: '100%', p: 2, textAlign: 'center' }}>
      {children}
    </Box>
  );
}

const destinationPoint = (
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
function Watchers({ share }: { share: LiveShare | null }) {
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
const savedAt = (places: SavedPlace[], point: { lat: number; lng: number } | null) =>
  point ? places.find((place) => distanceBetween(place, point) < 30) : undefined;

/**
 * Sharing where one is, for the person sharing. First a map with where they
 * are and, if they want, where they are going: either can be dragged, a tap
 * on the map drops the destination, and both can be searched for or picked
 * from saved places. Then either a pin ("come and get me here"), or their
 * position live while they drive.
 */
export function DriveScreen({ open, onClose, conversationId, drive, share, audience }: DriveScreenProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const now = useNow(1000);
  const live = drive.state === 'sharing' && !drive.pinned;
  // A pin stays up with nothing sending, so it is shown as it is, after a reload too.
  const pinned = (drive.state === 'sharing' && drive.pinned) || (drive.state !== 'sharing' && Boolean(share?.fixed));
  // A live share running on the server without this phone sending: after a reload, or after leaving the chat.
  const paused = drive.state !== 'sharing' && share !== null && !share.fixed;
  const choosing = open && !live && !pinned && !paused;

  // Where the phone is, found each time the map opens to choose from.
  const [here, setHere] = useState<GeolocationPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  /** Where the person said they are, by dragging their dot or picking a place; else the phone's own idea. */
  const [from, setFrom] = useState<PickedPlace | null>(null);
  const [to, setTo] = useState<PickedPlace | null>(null);
  const [activeField, setActiveField] = useState<'from' | 'to'>('to');
  const [searchField, setSearchField] = useState<'from' | 'to' | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [saving, setSaving] = useState<{ point: PickedPlace; address: string } | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const locateAttempt = useRef(0);
  const cancelLocate = useCallback(() => {
    locateAttempt.current++;
  }, []);

  const locate = useCallback(async () => {
    const attempt = ++locateAttempt.current;
    setLocating(true);
    setLocateError(null);
    try {
      // A coarse/cached fix makes the picker useful quickly; live tracking still requests high accuracy.
      const position = await currentPosition({ enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 });
      if (attempt === locateAttempt.current) setHere(position);
    } catch (cause) {
      if (attempt === locateAttempt.current) {
        setHere(null);
        setLocateError((cause as Error).message);
      }
    } finally {
      if (attempt === locateAttempt.current) setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (!choosing) return;
    let active = true;
    void locate();
    void chatApi
      .listSavedPlaces(conversationId)
      .then((places) => {
        if (active) setSavedPlaces(places);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      cancelLocate();
    };
  }, [choosing, conversationId, locate, cancelLocate]);

  // With no idea where the phone is, the first thing to put on the map is where the person is.
  const lost = Boolean(locateError) && !here;
  useEffect(() => {
    if (lost) setActiveField('from');
  }, [lost]);

  // What was picked is for one share; the next starts afresh.
  const started = drive.state === 'sharing';
  useEffect(() => {
    if (!started) return;
    setFrom(null);
    setTo(null);
  }, [started]);

  const gps = here ? { lat: here.coords.latitude, lng: here.coords.longitude } : null;
  const me = from ?? gps;
  const rough = !from && here !== null && here.coords.accuracy > ROUGH_GUESS_M;
  const meSaved = savedAt(savedPlaces, me);
  const toSaved = savedAt(savedPlaces, to);
  const meAddress = usePlaceAt(me);
  const toAddress = usePlaceAt(to);
  /** What a point is called: what it was picked as, a saved place there, or its address. */
  const meName = me ? from?.label || meSaved?.name || placeText(meAddress, me) : '';
  const toName = to ? to.label || toSaved?.name || placeText(toAddress, to) : '';
  /** The address under a name, when the name is not the address already. */
  const under = (name: string, address: ReturnType<typeof usePlaceAt>, point: { lat: number; lng: number }) => {
    const text = placeText(address, point);
    return address !== undefined && text !== name ? text : null;
  };

  const pick = (which: 'from' | 'to') => (option: PlaceOption) => {
    setActiveField(which);
    if (option.key === 'gps') {
      setFrom(null);
      if (gps) setFocus({ ...gps, key: Date.now() });
      return;
    }
    const picked = { lat: option.lat!, lng: option.lng!, label: option.name };
    if (which === 'from') setFrom(picked);
    else setTo(picked);
    setFocus({ lat: picked.lat, lng: picked.lng, key: Date.now() });
  };

  const searchFor = (which: 'from' | 'to') => (searching: boolean) => {
    if (searching) {
      setActiveField(which);
      setSearchField(which);
    } else setSearchField((current) => (current === which ? null : current));
  };
  const movePoint = (which: 'from' | 'to', point: { lat: number; lng: number }) => {
    setActiveField(which);
    setSearchField(null);
    if (which === 'from') setFrom({ ...point, label: null });
    else setTo({ ...point, label: null });
  };

  const save = async (name: string) => {
    if (!saving) return;
    const place = await chatApi.savePlace(conversationId, {
      name,
      lat: saving.point.lat,
      lng: saving.point.lng,
      address: saving.address
    });
    setSavedPlaces((current) => [...current, place].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const forget = async (place: SavedPlace) => {
    if (!window.confirm(`Delete "${place.name}" from saved places?`)) return;
    setPlaceError(null);
    try {
      await chatApi.deleteSavedPlace(conversationId, place.id);
      setSavedPlaces((current) => current.filter((entry) => entry.id !== place.id));
    } catch {
      setPlaceError('Could not delete that place. Try again.');
    }
  };

  const destination = to ? { lat: to.lat, lng: to.lng, label: toName } : null;
  const bottom = phone ? 'calc(16px + env(safe-area-inset-bottom))' : 2;
  const shown = drive.position ?? share?.position ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: phone ? undefined : { height: 'min(90vh, 760px)' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: surface.default }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            pt: phone ? 'calc(8px + env(safe-area-inset-top))' : 1
          }}
        >
          <NearMeOutlinedIcon sx={{ color: brand.pinkInk }} />
          <Typography variant="h6" sx={{ flex: 1, fontSize: 18 }}>
            {live ? `Sharing with ${audience}` : pinned ? `Pin shared with ${audience}` : 'Share where you are'}
          </Typography>
          <IconButton aria-label="Hide" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {drive.error && <Alert severity="error">{drive.error}</Alert>}
        {drive.state === 'stopping' && <Alert severity="info">Stopping sharing…</Alert>}

        {live && drive.position ? (
          <>
            <MapArea>
              <LiveMap
                points={[
                  { id: 'me', ...drive.position, color: PERSON_COLOR, label: 'You' },
                  ...(share?.destination ? [destinationPoint(share.destination)] : [])
                ]}
              />
            </MapArea>
            <Box sx={{ px: 2, pt: 1.5, pb: bottom, display: 'grid', gap: 1 }}>
              <Typography variant="body2" role="status" sx={{ color: drive.sendFailing ? 'error.main' : ink.body }}>
                {[
                  drive.sendFailing
                    ? 'Not getting through. Still trying'
                    : drive.lastSentAt
                      ? `Sent ${ageText(drive.lastSentAt, now)}`
                      : 'Sending',
                  share?.destination?.distanceM !== null && share?.destination?.distanceM !== undefined
                    ? `${formatDistance(share.destination.distanceM)} to ${share.destination.label || 'go'}`
                    : null,
                  drive.position.speed && drive.position.speed > 1 ? `${kmh(drive.position.speed)} km/h` : null
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
              <Watchers share={share} />
              {now - drive.position.at > STALE_MS && (
                <Alert severity="warning" sx={{ py: 0 }}>
                  Waiting for a fresh GPS position. Others see when your location was last updated.
                </Alert>
              )}
              {drive.screen === 'unavailable' && (
                <Alert severity="warning" sx={{ py: 0 }}>
                  This phone will not keep the screen on for Tumbaland. Keep it on yourself, or sharing pauses.
                </Alert>
              )}
              <Button variant="contained" color="error" size="large" onClick={drive.stop}>
                Stop sharing
              </Button>
            </Box>
          </>
        ) : pinned ? (
          <>
            <MapArea>
              {shown ? (
                <LiveMap
                  points={[
                    { id: 'me', lat: shown.lat, lng: shown.lng, color: PERSON_COLOR, label: share?.pinLabel || 'You' },
                    ...(share?.destination ? [destinationPoint(share.destination)] : [])
                  ]}
                />
              ) : (
                <Centred>
                  <CircularProgress />
                </Centred>
              )}
            </MapArea>
            <Box sx={{ px: 2, pt: 1.5, pb: bottom, display: 'grid', gap: 1 }}>
              <Typography variant="body2" role="status" sx={{ color: drive.sendFailing ? 'error.main' : ink.body }}>
                {drive.sendFailing
                  ? 'Not getting through. Still trying'
                  : `${audience} sees this pin for up to four hours, or until you remove it. Tumbaland can be closed.`}
              </Typography>
              <Watchers share={share} />
              <Button
                variant="contained"
                color="error"
                size="large"
                onClick={drive.stop}
                disabled={drive.state === 'stopping'}
              >
                Remove pin
              </Button>
            </Box>
          </>
        ) : paused ? (
          <Box sx={{ px: 2, pb: 2, display: 'grid', gap: 2 }}>
            <Typography variant="body1">You are still sharing, but this phone is not sending right now.</Typography>
            <Button
              variant="contained"
              size="large"
              disabled={drive.state === 'starting' || drive.state === 'stopping'}
              onClick={() => void drive.start()}
              startIcon={<NearMeOutlinedIcon />}
            >
              Keep sending
            </Button>
            <Button color="error" onClick={drive.stop} disabled={drive.state === 'stopping'}>
              Stop sharing
            </Button>
          </Box>
        ) : (
          <>
            <MapArea>
              <LiveMap
                points={[
                  ...(me
                    ? [
                        {
                          id: 'me',
                          ...me,
                          accuracy: from ? null : here?.coords.accuracy,
                          color: PERSON_COLOR,
                          label: 'You',
                          onMove: (point: { lat: number; lng: number }) => movePoint('from', point)
                        }
                      ]
                    : []),
                  ...(to
                    ? [
                        destinationPoint(
                          { ...to, label: toName },
                          { onMove: (point) => movePoint('to', point), onClick: () => setTo(null) }
                        )
                      ]
                    : [])
                ]}
                follow={false}
                focus={focus}
                onMapClick={(point) => movePoint(activeField, point)}
              />
            </MapArea>

            <Box sx={{ px: 2, pt: 1.5, pb: bottom, display: 'grid', gap: 1, overflowY: 'auto', maxHeight: '55%' }}>
              {locating && !me && (
                <Typography variant="body2" role="status" sx={{ color: ink.muted }}>
                  Finding where you are…
                </Typography>
              )}
              {locateError && (
                <Alert severity="warning" action={<Button onClick={() => void locate()}>Try again</Button>}>
                  {locateError} Tap the map where you are, or search for it.
                </Alert>
              )}
              {rough && (
                <Typography variant="body2" sx={{ color: 'warning.main' }}>
                  Your location may be off by about {formatDistance(here!.coords.accuracy)}. Drag your dot to where you
                  are, or search for it below.
                </Typography>
              )}

              <PlaceField
                label="From"
                active={activeField === 'from'}
                searching={searchField === 'from'}
                onSearchingChange={searchFor('from')}
                primary={from ? meName : meSaved?.name || 'Your location'}
                secondary={me ? under(from ? meName : meSaved?.name || 'Your location', meAddress, me) : null}
                color={PERSON_COLOR}
                filled={Boolean(me)}
                saved={Boolean(meSaved)}
                savedPlaces={savedPlaces}
                extraOptions={from ? [YOUR_LOCATION] : []}
                near={gps}
                onPick={pick('from')}
                onSave={
                  me ? () => setSaving({ point: { ...me, label: null }, address: placeText(meAddress, me) }) : undefined
                }
                onClear={from && gps ? () => setFrom(null) : undefined}
              />
              <PlaceField
                label="To"
                active={activeField === 'to'}
                searching={searchField === 'to'}
                onSearchingChange={searchFor('to')}
                primary={to ? toName : 'Where to? Search, pick a place, or tap the map'}
                secondary={to ? under(toName, toAddress, to) : null}
                color={DESTINATION_COLOR}
                filled={Boolean(to)}
                saved={Boolean(toSaved)}
                savedPlaces={savedPlaces}
                near={me}
                onPick={pick('to')}
                onSave={to ? () => setSaving({ point: to, address: placeText(toAddress, to) }) : undefined}
                onClear={to ? () => setTo(null) : undefined}
              />

              {savedPlaces.length > 0 && (
                <Box role="group" aria-label="Saved places" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {savedPlaces.map((place) => (
                    <Chip
                      key={place.id}
                      icon={<BookmarkIcon />}
                      label={place.name}
                      size="small"
                      onClick={() =>
                        pick('to')({
                          key: place.id,
                          group: 'Saved',
                          name: place.name,
                          detail: place.address,
                          lat: place.lat,
                          lng: place.lng
                        })
                      }
                      onDelete={() => void forget(place)}
                    />
                  ))}
                </Box>
              )}
              {placeError && <Alert severity="error">{placeError}</Alert>}

              <Typography variant="caption" sx={{ color: ink.muted }}>
                Tap the map to set {activeField === 'from' ? 'From' : 'To'}, or drag a dot to move it. Sharing ends
                after four hours, or when you stop it.
                {from ? '' : ' Live follows you while you drive, as long as Tumbaland stays on screen.'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  size="large"
                  variant={from ? 'contained' : 'outlined'}
                  disabled={!me || (locating && !from) || drive.state === 'starting' || drive.state === 'stopping'}
                  onClick={() =>
                    void drive.start({
                      destination,
                      place: me,
                      pin: true,
                      // Coordinates are no name: while the address is still on its way the pin goes
                      // without one, and the other side looks its address up itself.
                      pinLabel: from?.label || meSaved?.name || (meAddress ? placeText(meAddress, me!) : null)
                    })
                  }
                  startIcon={<PlaceOutlinedIcon />}
                >
                  Send pin
                </Button>
                {/* A place said by hand cannot be followed live: the GPS would move it straight back. */}
                {!from && (
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    disabled={!me || locating || drive.state === 'starting' || drive.state === 'stopping'}
                    onClick={() =>
                      void drive.start({
                        destination,
                        place: me && here ? { ...me, accuracy: here.coords.accuracy } : me
                      })
                    }
                    startIcon={
                      drive.state === 'starting' ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <NearMeOutlinedIcon />
                      )
                    }
                  >
                    Share live
                  </Button>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>

      <SavePlaceDialog
        open={Boolean(saving)}
        address={saving?.address ?? ''}
        onClose={() => setSaving(null)}
        onSave={save}
      />
    </Dialog>
  );
}
