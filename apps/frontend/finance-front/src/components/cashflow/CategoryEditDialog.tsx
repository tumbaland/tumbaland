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
import { useCreateCategoryRule } from '../../hooks/useCategoryRules';
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
 * Recategorise one transaction, every row from the same merchant, and — the
 * point of the dialog — teach the app to keep doing it.
 *
 * Imports leave a long tail of uncategorised rows, and a single merchant can
 * account for hundreds of them. Fixing those one at a time is not realistic, so
 * the bulk path is offered right where the mistake is noticed. But a bulk move
 * only rewrites rows that already exist: without a rule the same merchant
 * arrives uncategorised again next month, and the backlog comes back. Both are
 * offered together because they answer two halves of one question.
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
  const ruleMutation = useCreateCategoryRule();

  const [category, setCategory] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const counterparty = useMemo(() => counterpartyOf(transaction?.note), [transaction]);

  useEffect(() => {
    if (!open) return;
    setCategory(transaction?.category || '');
    setApplyToAll(false);
    // On by default. Someone correcting a category almost always wants it to
    // stick, and the cost of an unwanted rule is one click to delete it.
    setRemember(true);
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
    } catch {
      setError('Failed to update the category');
      return;
    }

    // Saved separately, and after the move, so a rule that fails to write
    // cannot roll back a recategorisation that already succeeded. The message
    // says which half happened rather than implying both did.
    if (remember && counterparty) {
      try {
        await ruleMutation.mutateAsync({
          pattern: counterparty,
          category: next,
          groupId: tenantGroupId
        });
        notify(`${counterparty} will be filed as ${next} from now on`, 'success');
      } catch {
        notify(`Category changed, but the rule for ${counterparty} could not be saved`, 'error');
      }
    }

    onClose();
  };

  const saving = updateMutation.isPending || bulkMutation.isPending || ruleMutation.isPending;

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
          <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Remember this for future imports' } }}
                />
              }
              label={
                <Typography variant="body2">
                  Remember: file {counterparty} as <strong>{category.trim() || '…'}</strong> in
                  future imports
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Apply to existing rows from this merchant' } }}
                />
              }
              label={
                <Typography variant="body2">
                  Apply to every <strong>{transaction?.category}</strong> row from {counterparty}
                </Typography>
              }
            />
          </Box>
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
