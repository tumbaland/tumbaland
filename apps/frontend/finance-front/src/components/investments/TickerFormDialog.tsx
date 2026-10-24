import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  TextField
} from '@mui/material';
import TickerSearch from './TickerSearch';

export interface TickerForm {
  ticker: string;
  displayName: string;
  currency: string;
  description: string;
  isActive: boolean;
}

export const emptyTickerForm: TickerForm = { ticker: '', displayName: '', currency: '', description: '', isActive: true };

interface TickerFormDialogProps {
  open: boolean;
  editing: boolean;
  form: TickerForm;
  setForm: React.Dispatch<React.SetStateAction<TickerForm>>;
  /** The symbol as saved, when the ticker field has been changed away from it. */
  renamingFrom?: string;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

/** Tracks a ticker, or edits one. */
const TickerFormDialog: React.FC<TickerFormDialogProps> = ({
  open,
  editing,
  form,
  setForm,
  renamingFrom,
  submitting,
  onSubmit,
  onClose
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{editing ? 'Edit ticker' : 'Track ticker'}</DialogTitle>
    <DialogContent>
      {!editing && (
        <Box sx={{ mb: 2, mt: 1 }}>
          <TickerSearch
            onSelect={(r) =>
              setForm((f) => ({ ...f, ticker: r.symbol, displayName: r.name, currency: r.currency || '' }))
            }
          />
        </Box>
      )}
      <TextField
        margin="dense"
        label="Ticker"
        fullWidth
        required
        value={form.ticker}
        onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
        helperText={
          renamingFrom
            ? `Price history, holdings and trades for ${renamingFrom} will move to ${form.ticker}.`
            : undefined
        }
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        margin="dense"
        label="Display name"
        fullWidth
        required
        value={form.displayName}
        onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        margin="dense"
        label="Currency"
        fullWidth
        value={form.currency}
        onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))}
        placeholder="EUR"
        helperText="Currency this instrument is quoted in — used to convert its prices into your base currency."
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        margin="dense"
        label="Description"
        fullWidth
        multiline
        rows={2}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <FormControlLabel
        control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
        label="Update price daily"
        sx={{ mt: 1 }}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={() => onClose()}>Cancel</Button>
      <Button onClick={onSubmit} variant="contained" disabled={submitting}>
        {editing ? 'Update' : 'Add'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default TickerFormDialog;
