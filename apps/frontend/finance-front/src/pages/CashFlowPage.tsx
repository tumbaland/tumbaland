import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';
import { useTenantFilter } from '@tumbaland/components';
import {
  useTransactions,
  useTransactionCategories,
  useCashflowSummary,
  useBudgets,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction
} from '../hooks/useCashflow';
import { Transaction } from '../services/cashflowService';
import TransactionDialog from '../components/cashflow/TransactionDialog';
import BudgetManagerDialog from '../components/cashflow/BudgetManagerDialog';
import CashflowSummaryCards from '../components/cashflow/CashflowSummaryCards';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatCurrency } from '../utils/numberUtils';

/**
 * The cash-flow layer: what came in and went out, and what that explains about
 * the net-worth line on the dashboard.
 */
const CashFlowPage: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { data: transactions = [], isLoading, error } = useTransactions({ groupId: tenantGroupId });
  const { data: categories = [] } = useTransactionCategories(tenantGroupId);
  const { data: summary } = useCashflowSummary(tenantGroupId);
  const { data: budgets = [] } = useBudgets(tenantGroupId);

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const notify = (message: string, severity: 'success' | 'error') => setSnackbar({ message, severity });

  const handleSubmit = async (data: Omit<Transaction, '_id'>) => {
    if (editing?._id) {
      await updateMutation.mutateAsync({ id: editing._id, data });
      notify('Transaction updated', 'success');
    } else {
      await createMutation.mutateAsync(data);
      notify('Transaction added', 'success');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      notify('Transaction deleted', 'success');
    } catch {
      notify('Failed to delete the transaction', 'error');
    }
    setDeleteTarget(null);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setDialogOpen(true);
  };

  // Income reads positive and expense negative, so a column of amounts scans
  // the way a bank statement does.
  const signed = (transaction: Transaction) =>
    transaction.type === 'income' ? transaction.amount : -transaction.amount;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load transactions</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Cash Flow</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            What you earn and spend — and how much of your net-worth change it explains
          </Typography>
        </Box>
        <Button startIcon={<WalletIcon />} onClick={() => setBudgetsOpen(true)}>
          Budgets
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add transaction
        </Button>
      </Box>

      {summary && summary.months.length > 0 && <CashflowSummaryCards summary={summary} />}

      {transactions.length === 0 ? (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 6, textAlign: 'center' }}
        >
          <WalletIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
            No transactions yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Record what comes in and goes out, and the dashboard can tell you whether your net worth
            grew because you saved or because the market moved.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add your first transaction
          </Button>
        </Paper>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {transactions.map((transaction) => (
            <Paper
              key={transaction._id}
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{transaction.category}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {transaction.date.slice(0, 10)}
                    {transaction.note ? ` · ${transaction.note}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => openEdit(transaction)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(transaction)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, mt: 1, color: transaction.type === 'income' ? 'success.main' : 'error.main' }}
              >
                {transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount)}
              </Typography>
            </Paper>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Note</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right" sx={{ width: 110 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction._id} hover>
                  <TableCell>{transaction.date.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={transaction.category}
                      color={transaction.type === 'income' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{transaction.note || '—'}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 600, color: transaction.type === 'income' ? 'success.main' : 'error.main' }}
                  >
                    {transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(transaction)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(transaction)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TransactionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        transaction={editing}
        categories={categories}
        tenantGroupId={tenantGroupId}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <BudgetManagerDialog
        open={budgetsOpen}
        onClose={() => setBudgetsOpen(false)}
        budgets={budgets}
        categories={categories}
        tenantGroupId={tenantGroupId}
        notify={notify}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete transaction"
        message={`Delete the ${deleteTarget ? formatCurrency(Math.abs(signed(deleteTarget))) : ''} ${deleteTarget?.category} entry? This cannot be undone.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity || 'success'} onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CashFlowPage;
