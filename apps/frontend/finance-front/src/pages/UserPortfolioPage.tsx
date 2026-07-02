import React, { useEffect, useState } from 'react';
import { useTenantFilter } from '../components/tenant';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TableFooter,
  TableSortLabel,
  Tooltip,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  useUserPortfolios,
  useCreateUserPortfolio,
  useUpdateUserPortfolio,
  useDeleteUserPortfolio
} from '../hooks/useUserPortfolio';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { UserPortfolio } from '../services/userPortfolioService';

// Keep numeric fields as strings during editing so the user sees exactly what
// they typed (including commas). We parse to numbers only on submit.
interface PortfolioFormState {
  ticker: string;
  quantity: string;
  avgBuyPrice: string;
}

const defaultForm: PortfolioFormState = {
  ticker: '',
  quantity: '',
  avgBuyPrice: ''
};

// Accepts both dot (12.5) and comma (12,5) decimal separators.
// Also handles European thousands+decimal format: 12.504,00 → 12504.00
function parseNumericInput(value: string): number {
  const s = value.trim();
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (s.includes(',')) {
    return parseFloat(s.replace(',', '.')) || 0;
  }
  return parseFloat(s) || 0;
}

const UserPortfolioPage: React.FC = () => {
  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  // React Query hooks
  const { data: portfolios = [], isLoading } = useUserPortfolios(tenantGroupId);
  const { data: trackedTickers = [] } = useTrackedTickers(tenantGroupId);
  const createMutation = useCreateUserPortfolio();
  const updateMutation = useUpdateUserPortfolio();
  const deleteMutation = useDeleteUserPortfolio();

  // UI state
  const [form, setForm] = useState<PortfolioFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderBy, setOrderBy] = useState<keyof UserPortfolio>('ticker');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Success/Error notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Handle mutation success/error
  useEffect(() => {
    if (createMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Portfolio entry created successfully', severity: 'success' });
      createMutation.reset();
      handleCloseDialog();
    }
    if (createMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to create portfolio entry', severity: 'error' });
      createMutation.reset();
    }
  }, [createMutation.isSuccess, createMutation.isError]);

  useEffect(() => {
    if (updateMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Portfolio entry updated successfully', severity: 'success' });
      updateMutation.reset();
      handleCloseDialog();
    }
    if (updateMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to update portfolio entry', severity: 'error' });
      updateMutation.reset();
    }
  }, [updateMutation.isSuccess, updateMutation.isError]);

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Portfolio entry deleted successfully', severity: 'success' });
      deleteMutation.reset();
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
    if (deleteMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to delete portfolio entry', severity: 'error' });
      deleteMutation.reset();
    }
  }, [deleteMutation.isSuccess, deleteMutation.isError]);

  const handleOpenDialog = (portfolio?: UserPortfolio) => {
    if (portfolio) {
      setForm({
        ticker: portfolio.ticker,
        quantity: String(portfolio.quantity),
        avgBuyPrice: String(portfolio.avgBuyPrice)
      });
      setEditingId(portfolio._id!);
    } else {
      setForm(defaultForm);
      setEditingId(null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ticker: form.ticker,
      quantity: parseNumericInput(form.quantity),
      avgBuyPrice: parseNumericInput(form.avgBuyPrice)
    };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data });
    } else {
      await createMutation.mutateAsync({ ...data, groupId: tenantGroupId });
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    await deleteMutation.mutateAsync(pendingDeleteId);
  };

  const handleSort = (property: keyof UserPortfolio) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedPortfolios = React.useMemo(() => {
    return [...portfolios].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      if (orderBy === 'buyDate') {
        aValue = aValue ? new Date(aValue as string).getTime() : 0;
        bValue = bValue ? new Date(bValue as string).getTime() : 0;
      }
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [portfolios, orderBy, order]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          User Portfolio
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ bgcolor: 'primary.main' }}
          onClick={() => handleOpenDialog()}
        >
          Add Entry
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <Table
          stickyHeader
          size="small"
          sx={{
            minWidth: 500,
            fontSize: { xs: '0.72rem', sm: '0.95rem' },
            '& th, & td': {
              px: { xs: 0.5, sm: 1 },
              py: { xs: 0.5, sm: 0.8 },
              fontSize: { xs: '0.72rem', sm: '0.95rem' },
              whiteSpace: { xs: 'nowrap', sm: 'normal' },
              maxWidth: { xs: 80, sm: 'none' },
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 60 }}>
                <TableSortLabel
                  active={orderBy === 'ticker'}
                  direction={orderBy === 'ticker' ? order : 'asc'}
                  onClick={() => handleSort('ticker')}
                >
                  <span style={{ fontSize: '0.72rem' }}>Ticker</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 80 }}>
                <TableSortLabel
                  active={orderBy === 'quantity'}
                  direction={orderBy === 'quantity' ? order : 'asc'}
                  onClick={() => handleSort('quantity')}
                >
                  <span style={{ fontSize: '0.72rem' }}>Quantity</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <TableSortLabel
                  active={orderBy === 'avgBuyPrice'}
                  direction={orderBy === 'avgBuyPrice' ? order : 'asc'}
                  onClick={() => handleSort('avgBuyPrice')}
                >
                  <span style={{ fontSize: '0.72rem' }}>Avg. Buy Price</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <TableSortLabel
                  active={orderBy === 'latestPrice'}
                  direction={orderBy === 'latestPrice' ? order : 'asc'}
                  onClick={() => handleSort('latestPrice')}
                >
                  <span style={{ fontSize: '0.72rem' }}>Latest Price</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <TableSortLabel
                  active={orderBy === 'athPrice'}
                  direction={orderBy === 'athPrice' ? order : 'asc'}
                  onClick={() => handleSort('athPrice')}
                >
                  <span style={{ fontSize: '0.72rem' }}>ATH Price</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <TableSortLabel
                  active={orderBy === 'currentValue'}
                  direction={orderBy === 'currentValue' ? order : 'asc'}
                  onClick={() => handleSort('currentValue')}
                >
                  <span style={{ fontSize: '0.72rem' }}>Current Value</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <TableSortLabel
                  active={orderBy === 'valueIncrease'}
                  direction={orderBy === 'valueIncrease' ? order : 'asc'}
                  onClick={() => handleSort('valueIncrease')}
                >
                  <span style={{ fontSize: '0.72rem' }}>Value Change</span>
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ minWidth: 80 }}>
                <TableSortLabel
                  active={orderBy === 'percentIncrease'}
                  direction={orderBy === 'percentIncrease' ? order : 'asc'}
                  onClick={() => handleSort('percentIncrease')}
                >
                  <span style={{ fontSize: '0.72rem' }}>% Change</span>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 60 }}>
                <span style={{ fontSize: '0.72rem' }}>Actions</span>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>Loading...</TableCell>
              </TableRow>
            ) : portfolios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>No portfolio entries found.</TableCell>
              </TableRow>
            ) : (
              sortedPortfolios.map((p, idx) => (
                <TableRow key={p._id || p.ticker || idx}>
                  <TableCell>{p.ticker}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell>{p.avgBuyPrice}</TableCell>
                  <TableCell>{p.latestPrice !== undefined ? p.latestPrice.toFixed(2) : '-'}</TableCell>
                  <TableCell>{p.athPrice !== undefined ? p.athPrice.toFixed(2) : '-'}</TableCell>
                  <TableCell>{p.currentValue !== undefined ? p.currentValue.toFixed(2) : '-'}</TableCell>
                  <TableCell>{p.valueIncrease !== undefined ? p.valueIncrease.toFixed(2) : '-'}</TableCell>
                  <TableCell>{p.percentIncrease !== undefined ? p.percentIncrease.toFixed(2) + '%' : '-'}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton color="primary" onClick={() => handleOpenDialog(p)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p._id ?? '');
                        }}
                        color="error"
                        disabled={!p._id || typeof p._id !== 'string' || p._id === ''}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>
                Total
              </TableCell>
              <TableCell />
              <TableCell sx={{ fontWeight: 'bold' }}>
                {portfolios.reduce((sum, p) => sum + (p.athPrice ?? 0) * p.quantity, 0).toFixed(2)}
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>
                {portfolios.reduce((sum, p) => sum + (p.currentValue ?? 0), 0).toFixed(2)}
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>
                {portfolios.reduce((sum, p) => sum + (p.valueIncrease ?? 0), 0).toFixed(2)}
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>
                {/* Weighted average percent change */}
                {(() => {
                  const totalBuyIn = portfolios.reduce((sum, p) => sum + p.avgBuyPrice * p.quantity, 0);
                  const totalCurrent = portfolios.reduce((sum, p) => sum + (p.latestPrice ?? 0) * p.quantity, 0);
                  if (totalBuyIn === 0) return '-';
                  const percent = ((totalCurrent - totalBuyIn) / totalBuyIn) * 100;
                  return percent.toFixed(2) + '%';
                })()}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Portfolio Entry' : 'Add Portfolio Entry'}</DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="dense" required>
              <InputLabel>Ticker</InputLabel>
              <Select
                label="Ticker"
                name="ticker"
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              >
                {trackedTickers.length === 0 && (
                  <MenuItem disabled value="">
                    No tracked tickers — add some first
                  </MenuItem>
                )}
                {trackedTickers.map((t) => (
                  <MenuItem key={t._id ?? t.ticker} value={t.ticker}>
                    {t.displayName} ({t.ticker})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Quantity"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              fullWidth
              required
            />
            <TextField
              margin="dense"
              label="Avg. Buy Price"
              name="avgBuyPrice"
              value={form.avgBuyPrice}
              onChange={handleChange}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              fullWidth
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingId ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <ConfirmationModal
        open={confirmOpen}
        title="Delete Portfolio Entry"
        message="Are you sure you want to delete this portfolio entry?"
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserPortfolioPage;
