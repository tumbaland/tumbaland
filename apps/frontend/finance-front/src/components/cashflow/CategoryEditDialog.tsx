import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Alert
} from '@mui/material';
import { Transaction } from '../../services/cashflowService';
import { useUpdateCategory, useRecategorise } from '../../hooks/useCashflow';
import { formatCurrency } from '../../utils/numberUtils';

interface CategoryEditDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  categories: string[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

/**
 * The counterparty a row starts with — the part before the bank's own free-text
 * description. Bulk changes match on this rather than the whole note, which
 * carries a terminal id and a timestamp unique to each payment.
 */
export function counterpartyOf(note: string | undefined): string {
  if (!note) return '';
  return note.split(' · ')[0].trim();
}

/**
 * Recategorise one transaction, or every row from the same merchant at once.
 *
 * Imports leave a long tail of uncategorised rows, and a single merchant can
 * account for hundreds of them. Fixing those one at a time is not realistic, so
 * the bulk path is offered right where the mistake is noticed.
 */
const CategoryEditDialog: React.FC<CategoryEditDialogProps> = ({
  open,
  onClose,
  transaction,
  categories,
  tenantGroupId,
  notify
}) => {
  const updateMutation = useUpdateCategory();
  const bulkMutation = useRecategorise();

  const [category, setCategory] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counterparty = useMemo(() => counterpartyOf(transaction?.note), [transaction]);

  useEffect(() => {
    if (!open) return;
    setCategory(transaction?.category || '');
    setApplyToAll(false);
    setError(null);
  }, [open, transaction]);

  const handleSubmit = async () => {
    const next = category.trim();
    if (!next) {
      setError('Pick or type a category');
      return;
    }
    if (!transaction?._id) return;

    setError(null);
    try {
      if (applyToAll && counterparty) {
        const { updated } = await bulkMutation.mutateAsync({
          fromCategory: transaction.category,
          toCategory: next,
          search: counterparty,
          groupId: tenantGroupId
        });
        notify(`Moved ${updated} transaction${updated === 1 ? '' : 's'} to ${next}`, 'success');
      } else {
        await updateMutation.mutateAsync({ id: transaction._id, category: next });
        notify(`Moved to ${next}`, 'success');
      }
      onClose();
    } catch {
      setError('Failed to update the category');
    }
  };

  const saving = updateMutation.isPending || bulkMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change category</DialogTitle>
      <DialogContent>
        {transaction && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {counterparty || transaction.category}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {transaction.date.slice(0, 10)} · {formatCurrency(transaction.amount)} · currently{' '}
              {transaction.category}
            </Typography>
          </Box>
        )}

        <Autocomplete
          freeSolo
          options={categories}
          inputValue={category}
          onInputChange={(_, value, reason) => {
            // Autocomplete also fires this with reason 'reset' when focus
            // leaves, which would discard a category typed for the first time.
            if (reason === 'reset') return;
            setCategory(value);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              label="Category"
              helperText="Pick one you already use, or type a new one"
              slotProps={{ ...params.slotProps, inputLabel: { shrink: true } }}
            />
          )}
        />

        {counterparty && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
            }
            label={
              <Typography variant="body2">
                Apply to every <strong>{transaction?.category}</strong> row from {counterparty}
              </Typography>
            }
          />
        )}

        {applyToAll && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Only rows currently in {transaction?.category} are touched, so this cannot reach
            anything you have already sorted.
          </Alert>
        )}

        {error && (
          <Box sx={{ mt: 1, color: 'error.main', fontSize: 14 }} role="alert">
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryEditDialog;
