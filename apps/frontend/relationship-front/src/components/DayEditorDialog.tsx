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
import { useTenantFilter } from '@tumbaland/components';
import { ApiError, logger } from '@tumbaland/frontend-core';
import { ActivityType, Day, DayEntryInput } from '../services/types';
import { getActivityTypes } from '../services/activityTypes';
import { getActivityDescriptions } from '../services/activities';
import { getDays, saveDay } from '../services/days';

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
}

/** per-type editing state: a type is "on" when it has at least one draft */
type Drafts = Record<string, EntryDraft[]>;

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * "How was your day?" editor: one checklist row per activity type.
 * - boolean types: the checkbox itself is the answer
 * - number types: an hours field
 * - string types: one or more description fields with past-entry autocomplete
 * Saving replaces the whole day in a single PUT /days/:date call.
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
        const day = daysResponse.days.find((d) => d.date === date);
        const next: Drafts = {};
        for (const entry of day?.entries ?? []) {
          const typeId = typeof entry.typeId === 'string' ? entry.typeId : (entry.typeId as any)?._id;
          if (!typeId) continue;
          (next[typeId] ??= []).push({
            _id: entry._id,
            description: entry.description ?? '',
            hours: entry.hours !== undefined && entry.hours !== null ? String(entry.hours) : ''
          });
        }
        setDrafts(next);
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
        next[type._id] = [{ description: '', hours: '' }];
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
    setDrafts((prev) => ({ ...prev, [typeId]: [...(prev[typeId] ?? []), { description: '', hours: '' }] }));
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

  const handleSave = async () => {
    if (!types) return;
    const entries: DayEntryInput[] = [];
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
        {loading || types === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : sortedTypes.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No activity types yet — create some under Activity Types first.
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
