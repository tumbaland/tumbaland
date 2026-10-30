import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography
} from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { describeError } from '../../hooks/useLoad';
import { UNITS_PER_DOLLAR, adminApi } from '../../services/adminApi';

/**
 * Gives one person a different assistant allowance than their plan does, as an
 * override with a reason, and optionally an end date. Dollars here, which is how
 * an admin thinks about it; the meter counts ten-thousandths of one.
 */
export function AllowanceDialog({ email, onClose, onSaved }: { email: string | null; onClose: () => void; onSaved: () => void }) {
  const [dollars, setDollars] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    setDollars('');
    setUnlimited(false);
    setReason('');
    setUntil('');
    setError(null);
  }, [email]);

  const amount = Number(dollars);
  const valid = Boolean(reason.trim()) && (unlimited || (dollars.trim() !== '' && Number.isFinite(amount) && amount >= 0));

  const save = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.setAllowance(email, unlimited ? -1 : Math.round(amount * UNITS_PER_DOLLAR), reason.trim(), until || undefined);
      onSaved();
      onClose();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={email !== null} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="allowance-title">
      <DialogTitle id="allowance-title">Change the allowance</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: ink.muted, mb: 2 }}>
          {email}. Replaces what their plan gives them each month, until the end date if you set one.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <FormControlLabel
          control={<Checkbox checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} />}
          label="No limit"
        />
        <TextField
          label="Dollars a month"
          type="number"
          value={dollars}
          onChange={(event) => setDollars(event.target.value)}
          disabled={unlimited || busy}
          slotProps={{ htmlInput: { min: 0, step: '0.5' } }}
          fullWidth
          margin="dense"
        />
        <TextField label="Why" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} fullWidth margin="dense" />
        <TextField
          label="Until"
          type="date"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
          disabled={busy}
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="Optional. Without it the change stays."
          fullWidth
          margin="dense"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !valid}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
