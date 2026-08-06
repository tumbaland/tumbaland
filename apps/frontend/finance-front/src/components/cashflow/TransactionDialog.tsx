import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete
} from '@mui/material';
import { Transaction, TransactionType } from '../../services/cashflowService';
import { parseNumericInput } from '../../utils/numberUtils';

interface TransactionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Transaction, '_id'>) => Promise<void>;
  /** Set when editing an existing row. */
  transaction?: Transaction | null;
  categories: string[];
  tenantGroupId?: string;
  saving: boolean;
}

interface Form {
  date: string;
  amount: string;
  type: TransactionType;
  category: string;
  note: string;
}

const emptyForm = (): Form => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  type: 'expense',
  category: '',
  note: ''
});

const TransactionDialog: React.FC<TransactionDialogProps> = ({
  open,
  onClose,
  onSubmit,
  transaction,
  categories,
  tenantGroupId,
  saving
}) => {
  const [form, setForm] = useState<Form>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      transaction
        ? {
            date: transaction.date.slice(0, 10),
            amount: String(transaction.amount),
            type: transaction.type,
            category: transaction.category,
            note: transaction.note || ''
          }
        : emptyForm()
    );
  }, [open, transaction]);

  const handleSubmit = async () => {
    const amount = parseNumericInput(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (!form.category.trim()) {
      setError('Pick or type a category');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        date: form.date,
        // Stored as a positive magnitude whichever direction it is
        amount,
        type: form.type,
        category: form.category.trim(),
        note: form.note.trim() || undefined,
        ...(tenantGroupId ? { groupId: tenantGroupId } : {})
      });
      onClose();
    } catch {
      setError('Failed to save the transaction');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{transaction ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={form.type}
          onChange={(_, type: TransactionType | null) => type && setForm((f) => ({ ...f, type }))}
          sx={{ mt: 1, mb: 2 }}
        >
          <ToggleButton value="expense">Expense</ToggleButton>
          <ToggleButton value="income">Income</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          margin="dense"
          label="Date"
          type="date"
          fullWidth
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          margin="dense"
          label="Amount (€)"
          fullWidth
          required
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
        />
        <Autocomplete
          freeSolo
          options={categories}
          inputValue={form.category}
          // Only the user's own edits count. Autocomplete also fires this with
          // reason 'reset' when focus leaves, restoring the input to the
          // (unset) selected option — which would silently discard a category
          // typed for the first time the moment you reach for Save.
          onInputChange={(_, value, reason) => {
            if (reason === 'reset') return;
            setForm((f) => ({ ...f, category: value }));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              margin="dense"
              label="Category"
              required
              helperText="Pick one you have used before, or type a new one"
              slotProps={{ ...params.slotProps, inputLabel: { shrink: true } }}
            />
          )}
        />
        <TextField
          margin="dense"
          label="Note"
          fullWidth
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {error && (
          <Box sx={{ mt: 1, color: 'error.main', fontSize: 14 }} role="alert">
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {transaction ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionDialog;

/** Re-exported so a caller can render a category picker with the same options. */
export const CategorySelect: React.FC<{
  value: string;
  categories: string[];
  onChange: (value: string) => void;
  label?: string;
}> = ({ value, categories, onChange, label = 'Category' }) => (
  <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    <MenuItem value="">All</MenuItem>
    {categories.map((category) => (
      <MenuItem key={category} value={category}>{category}</MenuItem>
    ))}
  </TextField>
);
