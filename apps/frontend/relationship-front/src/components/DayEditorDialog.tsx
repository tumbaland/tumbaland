import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { ApiError, logger } from '@tumbaland/frontend-core';
import { ActivityLocation, ActivityType, Day, DayEntryInput, Place } from '../services/types';
import { getActivityTypes } from '../services/activityTypes';
import { getActivityDescriptions } from '../services/activities';
import { getDays, saveDay } from '../services/days';
import { getPlaces } from '../services/places';
import LocationPicker from './map/LocationPicker';

interface DayEditorDialogProps {
  open: boolean;
  /** YYYY-MM-DD to edit; the dialog loads that day's current entries itself */
  date: string;
  /** allow changing the date (used by "Log a day"; off when opened from a day card) */
  dateEditable?: boolean;
  onClose: () => void;
  onSaved: (day: Day) => void;
}

interface EntryDraft {
  _id?: string;
  description: string;
  hours: string; // keep as text while editing
  location: ActivityLocation | null;
}

/** per-type editing state: a type is "on" when it has at least one draft */
type Drafts = Record<string, EntryDraft[]>;

/** An existing entry whose type is not in this scope's list — kept, not shown. */
interface OrphanEntry extends DayEntryInput {
  _id: string;
  typeName?: string;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * "How was your day?" editor: one checklist row per activity type.
 * - boolean types: the checkbox itself is the answer
 * - number types: an hours field
 * - string types: one or more description fields with past-entry autocomplete
 * Types with hasLocation additionally get a place picker, independent of
 * valueType. Saving replaces the whole day in a single PUT /days/:date call.
 */
const DayEditorDialog: React.FC<DayEditorDialogProps> = ({
  open,
  date: initialDate,
  dateEditable = false,
  onClose,
  onSaved
}) => {
  const groupId = useTenantFilter();
  const [date, setDate] = useState(initialDate || todayKey());
  const [types, setTypes] = useState<ActivityType[] | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptionOptions, setDescriptionOptions] = useState<Record<string, string[]>>({});
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  /**
   * Entries recorded against a type this scope no longer offers — a personal
   * type used inside a group before that was closed off, or a type since
   * deleted. They have no row to edit, but saving the day rewrites it whole, so
   * leaving them out of the payload would delete them without anyone asking.
   * They ride along untouched until the migration re-points them.
   */
  const [orphanEntries, setOrphanEntries] = useState<OrphanEntry[]>([]);

  // Load activity types + the day's current entries whenever the target day changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getActivityTypes({ groupId }),
      getDays({ startDate: date, endDate: date, limit: 1, groupId })
    ])
      .then(([typesResponse, daysResponse]) => {
        if (cancelled) return;
        setTypes(typesResponse.data);

        // Only fetch the place history if some type can actually use it.
        if (typesResponse.data.some((type) => type.hasLocation)) {
          getPlaces({ groupId })
            .then((places) => {
              if (!cancelled) setSavedPlaces(places);
            })
            .catch((e) => logger.error('Failed to load saved places', e));
        }

        const day = daysResponse.days.find((d) => d.date === date);
        const known = new Set(typesResponse.data.map((type) => type._id));
        const next: Drafts = {};
        const orphans: OrphanEntry[] = [];
        for (const entry of day?.entries ?? []) {
          // The API type says typeId is always a string, but a populated
          // reference from the backend can still come through as an object.
          const rawTypeId = entry.typeId as unknown as string | { _id: string };
          const typeId = typeof rawTypeId === 'string' ? rawTypeId : rawTypeId?._id;
          if (!typeId) continue;
          if (!known.has(typeId)) {
            orphans.push({
              _id: entry._id,
              typeId,
              typeName: entry.type?.name,
              ...(entry.description !== undefined ? { description: entry.description } : {}),
              ...(entry.hours !== undefined ? { hours: entry.hours } : {}),
              ...(entry.location ? { location: entry.location } : {})
            });
            continue;
          }
          (next[typeId] ??= []).push({
            _id: entry._id,
            description: entry.description ?? '',
            hours: entry.hours !== undefined && entry.hours !== null ? String(entry.hours) : '',
            location: entry.location ?? null
          });
        }
        setDrafts(next);
        setOrphanEntries(orphans);
      })
      .catch((e) => {
        if (!cancelled) {
          logger.error('Failed to load day', e);
          setError('Failed to load this day');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, date, groupId]);

  // Reset to the requested date each time the dialog opens
  useEffect(() => {
    if (open) setDate(initialDate || todayKey());
  }, [open, initialDate]);

  const loadDescriptions = useCallback(
    (typeId: string) => {
      if (descriptionOptions[typeId]) return;
      getActivityDescriptions(typeId, groupId)
        .then((options) => setDescriptionOptions((prev) => ({ ...prev, [typeId]: options })))
        .catch(() => setDescriptionOptions((prev) => ({ ...prev, [typeId]: [] })));
    },
    [descriptionOptions, groupId]
  );

  const toggleType = (type: ActivityType) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (next[type._id]?.length) {
        delete next[type._id];
      } else {
        next[type._id] = [{ description: '', hours: '', location: null }];
        if (type.valueType === 'string') loadDescriptions(type._id);
      }
      return next;
    });
  };

  const patchDraft = (typeId: string, index: number, patch: Partial<EntryDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [typeId]: prev[typeId].map((d, i) => (i === index ? { ...d, ...patch } : d))
    }));
  };

  const addDraft = (typeId: string) => {
    setDrafts((prev) => ({ ...prev, [typeId]: [...(prev[typeId] ?? []), { description: '', hours: '', location: null }] }));
  };

  const removeDraft = (typeId: string, index: number) => {
    setDrafts((prev) => {
      const rest = prev[typeId].filter((_, i) => i !== index);
      const next = { ...prev };
      if (rest.length === 0) delete next[typeId];
      else next[typeId] = rest;
      return next;
    });
  };

  const sortedTypes = useMemo(
    () => (types ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [types]
  );

  const orphanNames = useMemo(
    () => [...new Set(orphanEntries.map((entry) => entry.typeName).filter(Boolean))].join(', '),
    [orphanEntries]
  );

  const handleSave = async () => {
    if (!types) return;
    // Carried through unchanged so a save does not delete what the editor
    // cannot show; `typeName` is display-only and never sent.
    const entries: DayEntryInput[] = orphanEntries.map(({ typeName: _typeName, ...entry }) => entry);
    for (const type of types) {
      for (const draft of drafts[type._id] ?? []) {
        const entry: DayEntryInput = { typeId: type._id };
        if (draft._id) entry._id = draft._id;
        if (type.valueType === 'number') {
          const hours = parseInt(draft.hours, 10);
          if (draft.hours !== '' && (isNaN(hours) || hours < 0)) {
            setError(`${type.name}: hours must be a non-negative whole number`);
            return;
          }
          if (!isNaN(hours)) entry.hours = hours;
        } else if (type.valueType !== 'boolean' && draft.description.trim()) {
          entry.description = draft.description.trim();
        }
        // null (not undefined) so an existing place is cleared on save
        if (type.hasLocation) entry.location = draft.location;
        entries.push(entry);
      }
    }

    setSaving(true);
    setError(null);
    try {
      const day = await saveDay(date, entries, groupId);
      onSaved(day);
      onClose();
    } catch (e) {
      logger.error('Failed to save day', e);
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Failed to save day');
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, pb: 0.5 }}>
        {dateEditable ? 'Log a day' : formattedDate}
        {dateEditable && (
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            size="small"
            sx={{ display: 'block', mt: 1.5 }}
            slotProps={{ htmlInput: { max: todayKey() } }}
          />
        )}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        {orphanEntries.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            {orphanEntries.length === 1 ? '1 entry' : `${orphanEntries.length} entries`} on this day
            use an activity type that is not in this journal
            {orphanNames ? ` (${orphanNames})` : ''}. They are kept as they are. You cannot edit
            them here.
          </Alert>
        )}
        {loading || types === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : sortedTypes.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No activity types yet — add some with &ldquo;Manage types&rdquo; on the journal first.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              What did you do together?
            </Typography>
            {sortedTypes.map((type) => {
              const typeDrafts = drafts[type._id] ?? [];
              const checked = typeDrafts.length > 0;
              return (
                <Box
                  key={type._id}
                  sx={{
                    borderRadius: 2,
                    px: 1,
                    py: 0.5,
                    mb: 0.5,
                    bgcolor: checked ? 'action.selected' : 'transparent',
                    transition: 'background-color 0.15s'
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => toggleType(type)}
                  >
                    <Checkbox checked={checked} size="small" sx={{ p: 0.5, mr: 1 }} />
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: type.color || '#9e9e9e',
                        mr: 1,
                        flexShrink: 0
                      }}
                    />
                    <Typography sx={{ fontWeight: checked ? 600 : 400 }}>{type.name}</Typography>
                  </Box>

                  {checked && type.valueType === 'number' && (
                    <TextField
                      label="Hours"
                      type="number"
                      size="small"
                      value={typeDrafts[0].hours}
                      onChange={(e) => patchDraft(type._id, 0, { hours: e.target.value })}
                      sx={{ ml: 5, my: 1, width: 120 }}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  )}

                  {checked && (type.valueType === 'string' || !type.valueType) && (
                    <Box sx={{ ml: 5, my: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {typeDrafts.map((draft, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Autocomplete
                            freeSolo
                            fullWidth
                            size="small"
                            options={descriptionOptions[type._id] ?? []}
                            inputValue={draft.description}
                            onInputChange={(_, value) =>
                              patchDraft(type._id, index, { description: value ?? '' })
                            }
                            onOpen={() => loadDescriptions(type._id)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                placeholder="What / where? (pick a past entry or type new)"
                              />
                            )}
                          />
                          {typeDrafts.length > 1 && (
                            <Tooltip title="Remove this entry">
                              <IconButton size="small" onClick={() => removeDraft(type._id, index)}>
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      ))}
                      <Button
                        onClick={() => addDraft(type._id)}
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                      >
                        Add another {type.name.toLowerCase()}
                      </Button>
                    </Box>
                  )}

                  {checked && type.hasLocation && (
                    <Box sx={{ ml: 5, my: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {typeDrafts.map((draft, index) => (
                        <LocationPicker
                          key={draft._id ?? index}
                          label={typeDrafts.length > 1 ? `Place ${index + 1}` : 'Place'}
                          value={draft.location}
                          savedPlaces={savedPlaces}
                          onChange={(location) => patchDraft(type._id, index, { location })}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading || types === null}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ px: 3 }}
        >
          {saving ? 'Saving…' : 'Save day'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DayEditorDialog;
