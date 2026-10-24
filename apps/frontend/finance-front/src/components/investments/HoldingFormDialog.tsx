import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import TickerSearch from './TickerSearch';

export interface HoldingForm {
  ticker: string;
  displayName: string;
  currency: string;
  quantity: string;
  avgBuyPrice: string;
  buyDate: string;
  notes: string;
}

export const emptyHoldingForm: HoldingForm = {
  ticker: '',
  displayName: '',
  currency: '',
  quantity: '',
  avgBuyPrice: '',
  buyDate: '',
  notes: ''
};

interface HoldingFormDialogProps {
  open: boolean;
  /** Editing keeps the instrument fixed: only the position's numbers and notes change. */
  editing: boolean;
  form: HoldingForm;
  setForm: React.Dispatch<React.SetStateAction<HoldingForm>>;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

/** Adds a holding, or edits one. */
const HoldingFormDialog: React.FC<HoldingFormDialogProps> = ({ open, editing, form, setForm, submitting, onSubmit, onClose }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{editing ? 'Edit holding' : 'Add holding'}</DialogTitle>
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
        slotProps={{ inputLabel: { shrink: true } }}
      />
      {!editing && (
        <TextField
          margin="dense"
          label="Display name"
          fullWidth
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      )}
      <TextField
        margin="dense"
        label="Quantity"
        fullWidth
        required
        value={form.quantity}
        onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
      />
      <TextField
        margin="dense"
        label={form.currency ? `Average buy price (${form.currency})` : 'Average buy price'}
        fullWidth
        required
        value={form.avgBuyPrice}
        onChange={(e) => setForm((f) => ({ ...f, avgBuyPrice: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
      />
      {!editing && (
        <TextField
          margin="dense"
          label="Currency"
          fullWidth
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))}
          placeholder="EUR"
          helperText="Currency the instrument is quoted in. Filled in automatically when you pick from search; leave blank to treat prices as already being in your base currency."
          slotProps={{ inputLabel: { shrink: true } }}
        />
      )}
      <TextField
        margin="dense"
        label="Buy date"
        type="date"
        fullWidth
        value={form.buyDate}
        onChange={(e) => setForm((f) => ({ ...f, buyDate: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        margin="dense"
        label="Notes"
        fullWidth
        multiline
        rows={2}
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
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

export default HoldingFormDialog;
