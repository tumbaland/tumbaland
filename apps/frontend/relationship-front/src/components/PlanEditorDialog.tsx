import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { ApiError, logger, useTenantFilter } from '@tumbaland/frontend-core';
import { ActivityLocation, ActivityType, Place, Plan } from '../services/types';
import { createPlan, deletePlan, logPlan, updatePlan } from '../services/plans';
import { getActivityTypes } from '../services/activityTypes';
import { getPlaces } from '../services/places';
import LocationPicker from './map/LocationPicker';
import ConfirmationModal from './ConfirmationModal';
import { localDayKey, todayKey } from '../utils/dates';

interface PlanEditorDialogProps {
  open: boolean;
  /** the plan to change; absent for a new one */
  plan?: Plan | null;
  /** YYYY-MM-DD a new plan starts on */
  date?: string;
  onClose: () => void;
  onSaved: (plan: Plan) => void;
  onDeleted?: (id: string) => void;
  /** after "Log it": the day it was logged on, so the day can be opened */
  onLogged?: (date: string) => void;
}

/** What a reminder can be, in minutes before. All-day plans count from 09:00. */
const TIMED_REMINDERS: Array<{ value: number; label: string }> = [
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 180, label: '3 hours before' },
  { value: 1440, label: '1 day before' }
];
const ALL_DAY_REMINDERS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'That morning at 9:00' },
  { value: 1440, label: 'The day before at 9:00' }
];
const DEFAULT_REMINDER = { timed: 60, allDay: 0 };

/** The day after a YYYY-MM-DD day, in the browser's calendar. */
const dayAfter = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  return localDayKey(new Date(year!, month! - 1, date! + 1));
};
const DEFAULT_TIME = '19:00';
/** A select can't hold null, so "no reminder" is this. */
const NONE = 'none';

/**
 * Making or changing a plan: what, when, where, and whether the group is
 * reminded in the chat. A plan whose day has come can be logged from here,
 * which makes it an entry in the journal.
 */
const PlanEditorDialog: React.FC<PlanEditorDialogProps> = ({
  open,
  plan,
  date: initialDate,
  onClose,
  onSaved,
  onDeleted,
  onLogged
}) => {
  const groupId = useTenantFilter();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [allDay, setAllDay] = useState(false);
  const [severalDays, setSeveralDays] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [time, setTime] = useState(DEFAULT_TIME);
  const [reminder, setReminder] = useState<string>(String(DEFAULT_REMINDER.timed));
  const [location, setLocation] = useState<ActivityLocation | null>(null);
  const [typeId, setTypeId] = useState('');
  const [notes, setNotes] = useState('');
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [busy, setBusy] = useState<'save' | 'delete' | 'log' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form from the plan (or blank, on the asked-for day) each time it opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(plan?.title ?? '');
    setDate(plan?.date ?? initialDate ?? todayKey());
    setAllDay(plan ? !plan.time : false);
    setSeveralDays(!!plan?.endDate);
    setEndDate(plan?.endDate ?? '');
    setTime(plan?.time ?? DEFAULT_TIME);
    setReminder(
      plan ? (plan.remindBefore === null ? NONE : String(plan.remindBefore)) : String(DEFAULT_REMINDER.timed)
    );
    setLocation(plan?.location ?? null);
    setTypeId(plan?.typeId ?? '');
    setNotes(plan?.notes ?? '');
  }, [open, plan, initialDate]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getActivityTypes({ groupId })
      .then((response) => {
        if (!cancelled) setTypes(response.data);
      })
      .catch((e) => logger.error('Failed to load activity types', e));
    getPlaces({ groupId })
      .then((places) => {
        if (!cancelled) setSavedPlaces(places);
      })
      .catch((e) => logger.error('Failed to load saved places', e));
    return () => {
      cancelled = true;
    };
  }, [open, groupId]);

  const reminderOptions = allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS;

  const toggleAllDay = (next: boolean) => {
    setAllDay(next);
    // A reminder only one kind offers ("3 hours before" an all-day plan) falls
    // back to that kind's default rather than being kept as something unseen.
    const options = next ? ALL_DAY_REMINDERS : TIMED_REMINDERS;
    if (reminder !== NONE && !options.some((option) => String(option.value) === reminder)) {
      setReminder(String(next ? DEFAULT_REMINDER.allDay : DEFAULT_REMINDER.timed));
    }
  };

  const toggleSeveralDays = (next: boolean) => {
    setSeveralDays(next);
    // A trip is usually all day; it starts as ending the day after.
    if (next) {
      if (!endDate || endDate <= date) setEndDate(dayAfter(date));
      if (!allDay) toggleAllDay(true);
    }
  };

  const fields = () => ({
    title: title.trim(),
    date,
    endDate: severalDays && endDate > date ? endDate : null,
    time: allDay ? null : time,
    remindBefore: reminder === NONE ? null : Number(reminder),
    location,
    typeId: typeId || null,
    notes: notes.trim()
  });

  const failed = (what: string, e: unknown) => {
    logger.error(`Failed to ${what} the plan`, e);
    setError(e instanceof ApiError || e instanceof Error ? e.message : `Could not ${what} the plan`);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Give the plan a name');
      return;
    }
    if (!allDay && !time) {
      setError('Choose a time, or make it all day');
      return;
    }
    if (severalDays && endDate < date) {
      setError('The last day can’t be before the first');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const saved = plan
        ? await updatePlan(plan.id, fields())
        : await createPlan({ ...fields(), ...(groupId ? { groupId } : {}) });
      onSaved(saved);
      onClose();
    } catch (e) {
      failed('save', e);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    setConfirmDelete(false);
    setBusy('delete');
    try {
      await deletePlan(plan.id);
      onDeleted?.(plan.id);
      onClose();
    } catch (e) {
      failed('delete', e);
    } finally {
      setBusy(null);
    }
  };

  const handleLog = async () => {
    if (!plan) return;
    if (!typeId) {
      setError('Choose the activity to log it as');
      return;
    }
    setBusy('log');
    setError(null);
    try {
      // What is on screen is what gets logged, so unsaved edits go first.
      await updatePlan(plan.id, fields());
      const { plan: logged } = await logPlan(plan.id, typeId);
      onSaved(logged);
      onClose();
      onLogged?.(logged.date);
    } catch (e) {
      failed('log', e);
    } finally {
      setBusy(null);
    }
  };

  const canLog = !!plan && !plan.loggedActivityId && plan.date <= todayKey();

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, pb: 0.5 }}>{plan ? 'Plan' : 'Plan something'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        {plan?.loggedActivityId && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
            This one is in the journal now.
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="What"
            placeholder="Concert, dinner with friends…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={!plan}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <TextField
              label={severalDays ? 'From' : 'Day'}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              sx={{ flex: '1 1 150px' }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {!allDay && (
              <TextField
                label="Time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                sx={{ flex: '1 1 110px' }}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { step: 300 }
                }}
              />
            )}
            {severalDays && (
              <TextField
                label="Until"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                sx={{ flex: '1 1 150px' }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: date } }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: -1 }}>
            <FormControlLabel
              control={<Switch checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />}
              label="All day"
            />
            <FormControlLabel
              control={<Switch checked={severalDays} onChange={(e) => toggleSeveralDays(e.target.checked)} />}
              label="Several days"
            />
          </Box>

          <Box>
            <TextField select label="Reminder" value={reminder} onChange={(e) => setReminder(e.target.value)} fullWidth>
              <MenuItem value={NONE}>No reminder</MenuItem>
              {reminderOptions.map((option) => (
                <MenuItem key={option.value} value={String(option.value)}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {reminder !== NONE && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.5
                }}
              >
                <NotificationsActiveOutlinedIcon sx={{ fontSize: 14 }} />
                {groupId ? 'Everyone in this journal gets it in your chat' : 'You get it as a notification'}
              </Typography>
            )}
          </Box>

          <LocationPicker label="Place" value={location} savedPlaces={savedPlaces} onChange={setLocation} />

          <TextField
            select
            label="Activity"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            helperText="What it goes in the journal as, once it happened"
            fullWidth
          >
            <MenuItem value="">Not chosen</MenuItem>
            {types.map((type) => (
              <MenuItem key={type._id} value={type._id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: type.color || '#9e9e9e'
                    }}
                  />
                  {type.name}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        {plan && (
          <Button color="error" onClick={() => setConfirmDelete(true)} disabled={!!busy} sx={{ mr: 'auto' }}>
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </Button>
        )}
        <Button onClick={onClose} disabled={!!busy} color="inherit">
          Cancel
        </Button>
        {canLog && (
          <Button onClick={handleLog} disabled={!!busy} variant="outlined">
            {busy === 'log' ? 'Logging…' : 'Log it'}
          </Button>
        )}
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!!busy}
          startIcon={busy === 'save' ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ px: 3 }}
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>

      <ConfirmationModal
        open={confirmDelete}
        title="Delete this plan?"
        message={plan ? `“${plan.title}” is removed from the calendar for everyone.` : ''}
        confirmText="Delete"
        severity="error"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
};

export default PlanEditorDialog;
