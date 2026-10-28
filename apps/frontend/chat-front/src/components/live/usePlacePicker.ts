import { useCallback, useEffect, useRef, useState } from 'react';
import { placeText, usePlaceAt } from '../../hooks/usePlaceAt';
import { chatApi } from '../../services/chatApi';
import { currentPosition } from '../../services/live';
import type { PickedPlace, SavedPlace } from '../../types';
import { savedAt } from './DriveParts';
import type { PlaceOption } from './PlaceField';

/** A browser's guess worse than this is likely a computer guessing from its connection. */
const ROUGH_GUESS_M = 1000;

interface UsePlacePickerOptions {
  conversationId: string;
  /** The map is open to choose from, so the phone's position is wanted. */
  choosing: boolean;
  /** A share has begun, so what was picked is spent. */
  started: boolean;
}

/**
 * Where the person is and where they are going, before a share starts: the
 * phone's own position, the From and To they pick or drag, the saved places to
 * choose from, and the names those points go by.
 */
export function usePlacePicker({ conversationId, choosing, started }: UsePlacePickerOptions) {
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

  return {
    here,
    locating,
    locateError,
    locate,
    from,
    setFrom,
    to,
    setTo,
    activeField,
    searchField,
    focus,
    savedPlaces,
    saving,
    setSaving,
    placeError,
    gps,
    me,
    rough,
    meSaved,
    toSaved,
    meAddress,
    toAddress,
    meName,
    toName,
    under,
    pick,
    searchFor,
    movePoint,
    save,
    forget
  };
}
