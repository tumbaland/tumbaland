import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Autocomplete
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Budget } from '../../services/cashflowService';
import { useCreateBudget, useUpdateBudget, useDeleteBudget } from '../../hooks/useCashflow';
import { parseNumericInput, formatCurrency } from '../../utils/numberUtils';
import ConfirmationModal from '../ConfirmationModal';

interface BudgetManagerDialogProps {
  open: boolean;
  onClose: () => void;
  budgets: Budget[];
  categories: string[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

/** Monthly spending ceilings per category — recurring, not re-entered monthly. */
const BudgetManagerDialog: React.FC<BudgetManagerDialogProps> = ({
  open,
  onClose,
  budgets,
  categories,
  tenantGroupId,
  notify
}) => {
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteBudget();

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  const budgetedCategories = new Set(budgets.map((b) => b.category));
  const available = categories.filter((c) => !budgetedCategories.has(c));

  const handleAdd = async () => {
    const parsed = parseNumericInput(amount);
    if (!category.trim() || isNaN(parsed) || parsed < 0) {
      notify('Pick a category and a monthly amount', 'error');
      return;
    }
    try {
      await createMutation.mutateAsync({ category: category.trim(), amount: parsed, groupId: tenantGroupId });
      notify(`Budget set for ${category.trim()}`, 'success');
      setCategory('');
      setAmount('');
    } catch {
      notify('Failed to save the budget — one may already exist for that category', 'error');
    }
  };

  const handleAmountChange = async (budget: Budget, value: string) => {
    const parsed = parseNumericInput(value);
    if (isNaN(parsed) || parsed < 0 || parsed === budget.amount) return;
    try {
      await updateMutation.mutateAsync({ id: budget._id!, data: { amount: parsed } });
    } catch {
      notify('Failed to update the budget', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      notify('Budget removed', 'success');
    } catch {
      notify('Failed to remove the budget', 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Monthly budgets</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            A budget applies every month. Spending is compared against it as an average over the
            months that have transactions.
          </Typography>

          {budgets.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right" sx={{ width: 160 }}>Per month</TableCell>
                  <TableCell align="right" sx={{ width: 50 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow key={budget._id}>
                    <TableCell>{budget.category}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        defaultValue={String(budget.amount)}
                        onBlur={(e) => handleAmountChange(budget, e.target.value)}
                        slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right' } } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setDeleteTarget(budget)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {budgets.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No budgets yet — set one for the categories you want to keep an eye on.
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, mt: 2, alignItems: 'flex-start' }}>
            <Autocomplete
              freeSolo
              size="small"
              sx={{ flexGrow: 1 }}
              options={available}
              inputValue={category}
              // See TransactionDialog: ignore the blur-time 'reset' so a newly
              // typed category survives the click on Add.
              onInputChange={(_, value, reason) => {
                if (reason === 'reset') return;
                setCategory(value);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Category"
                  slotProps={{ ...params.slotProps, inputLabel: { shrink: true } }}
                />
              )}
            />
            <TextField
              size="small"
              label="Per month (€)"
              sx={{ width: 150 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
            />
            <Button startIcon={<AddIcon />} onClick={handleAdd} disabled={createMutation.isPending}>
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Remove budget"
        message={`Remove the ${formatCurrency(deleteTarget?.amount || 0)} monthly budget for "${deleteTarget?.category}"? Transactions in that category are kept.`}
        confirmText="Remove"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default BudgetManagerDialog;
