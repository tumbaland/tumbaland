import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';

export interface SavePlaceDialogProps {
  open: boolean;
  /** The address being saved, shown so it is clear which place this is. */
  address: string;
  onClose: () => void;
  /** Rejects to keep the dialog open with an error. */
  onSave: (name: string) => Promise<void>;
}

/** Naming a place before it is kept: "Home", "Irja's", "Work". */
export function SavePlaceDialog({ open, address, onClose, onSave }: SavePlaceDialogProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
  }, [open]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim());
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={(event) => void save(event)}>
        <DialogTitle>Save this place</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
          <Typography variant="body2" sx={{ color: ink.muted }}>
            {address}
          </Typography>
          <TextField
            autoFocus
            label="Name"
            placeholder="Home"
            value={name}
            onChange={(event) => setName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <Typography variant="caption" sx={{ color: ink.muted }}>
            Saved places are there for everyone in this chat to pick.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
