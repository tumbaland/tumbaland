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
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import ConfirmationModal from '../components/ConfirmationModal';
import TickerHistoryModal from '../components/TickerHistoryModal';
import {
  useTrackedTickers,
  useCreateTrackedTicker,
  useUpdateTrackedTicker,
  useDeleteTrackedTicker
} from '../hooks/useTrackedTicker';
import { TrackedTicker, TickerSearchResult, searchTickers } from '../services/trackedTickerService';

const defaultForm: Omit<TrackedTicker, '_id' | 'dateAdded'> = {
  ticker: '',
  displayName: '',
  description: '',
  isActive: true
};

const TrackedTickersPage: React.FC = () => {
  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  // React Query hooks
  const { data: tickers = [], isLoading } = useTrackedTickers(tenantGroupId);
  const createMutation = useCreateTrackedTicker();
  const updateMutation = useUpdateTrackedTicker();
  const deleteMutation = useDeleteTrackedTicker();

  // UI state
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // Ticker search state (only shown when adding, not editing)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleTickerSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const results = await searchTickers(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) setSearchError('No results found');
    } catch (err: any) {
      const msg = err?.response?.status === 429
        ? 'Rate limit reached (25 calls/day on free plan). Try again tomorrow.'
        : 'Search failed. Check your API key or try again.';
      setSearchError(msg);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = (result: TickerSearchResult) => {
    setForm((f) => ({
      ...f,
      ticker: result.symbol,
      displayName: result.name
    }));
    setSearchResults([]);
    setSearchQuery('');
  };

  // Success/Error notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Handle mutation success/error
  useEffect(() => {
    if (createMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Ticker added successfully', severity: 'success' });
      createMutation.reset();
      handleCloseDialog();
    }
    if (createMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to add ticker', severity: 'error' });
      createMutation.reset();
    }
  }, [createMutation.isSuccess, createMutation.isError]);

  useEffect(() => {
    if (updateMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Ticker updated successfully', severity: 'success' });
      updateMutation.reset();
      handleCloseDialog();
    }
    if (updateMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to update ticker', severity: 'error' });
      updateMutation.reset();
    }
  }, [updateMutation.isSuccess, updateMutation.isError]);

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Ticker deleted successfully', severity: 'success' });
      deleteMutation.reset();
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
    if (deleteMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to delete ticker', severity: 'error' });
      deleteMutation.reset();
    }
  }, [deleteMutation.isSuccess, deleteMutation.isError]);

  const handleOpenDialog = (ticker?: TrackedTicker) => {
    if (ticker) {
      setForm({
        ticker: ticker.ticker,
        displayName: ticker.displayName,
        description: ticker.description || '',
        isActive: ticker.isActive
      });
      setEditingId(ticker._id!);
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
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: form });
    } else {
      await createMutation.mutateAsync({ ...form, groupId: tenantGroupId });
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

  const handleOpenHistory = (ticker: string) => {
    setSelectedTicker(ticker);
    setHistoryModalOpen(true);
  };

  const handleCloseHistory = () => {
    setHistoryModalOpen(false);
    setSelectedTicker(null);
  };

  // Helper to format date as DD.MM.YYYY
  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Tracked Tickers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ bgcolor: 'primary.main' }}
          onClick={() => handleOpenDialog()}
        >
          Add Ticker
        </Button>
      </Box>
      <TableContainer 
        component={Paper} 
        elevation={0}
        sx={{ 
          width: '100%',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            minWidth: 400,
            fontSize: { xs: '0.72rem', sm: '0.95rem' },
            '& th': {
              bgcolor: 'background.default',
              fontWeight: 600
            },
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
                <span style={{ fontSize: '0.72rem' }}>Ticker</span>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <span style={{ fontSize: '0.72rem' }}>Display Name</span>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <span style={{ fontSize: '0.72rem' }}>Date Added</span>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 60 }}>
                <span style={{ fontSize: '0.72rem' }}>Actions</span>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading...</TableCell>
              </TableRow>
            ) : tickers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No tracked tickers found.</TableCell>
              </TableRow>
            ) : (
              tickers.map((t, idx) => (
                <TableRow
                  key={t._id || t.ticker || idx}
                  hover
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleOpenHistory(t.ticker)}
                >
                  <TableCell>{t.ticker}</TableCell>
                  <TableCell>{t.displayName}</TableCell>
                  <TableCell>{formatDate(t.dateAdded)}</TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Edit">
                      <IconButton color="primary" onClick={() => handleOpenDialog(t)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t._id ?? '');
                        }}
                        color="error"
                        disabled={!t._id}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            elevation: 0,
            sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' }
          }
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Ticker' : 'Add Ticker'}</DialogTitle>
          <DialogContent>
            {/* Symbol search — only shown when adding */}
            {!editingId && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    display: 'block',
                    mb: 1
                  }}>
                  Search by name or symbol to auto-fill the fields below.{' '}
                  <Typography component="span" variant="caption" sx={{
                    color: "warning.main"
                  }}>
                    Uses 1 of 25 daily API calls (free plan).
                  </Typography>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="e.g. Vanguard Europe"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleTickerSearch())}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleTickerSearch}
                    disabled={searchLoading || searchQuery.trim().length < 2}
                    startIcon={<SearchIcon />}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {searchLoading ? 'Searching…' : 'Search'}
                  </Button>
                </Box>
                {searchError && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {searchError}
                  </Typography>
                )}
                {searchResults.length > 0 && (
                  <Box
                    sx={{
                      mt: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      maxHeight: 200,
                      overflowY: 'auto'
                    }}
                  >
                    {searchResults.map((r) => (
                      <Box
                        key={r.symbol}
                        onClick={() => handleSelectSearchResult(r)}
                        sx={{
                          px: 2,
                          py: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 'none' }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Typography variant="body2" sx={{
                            fontWeight: 600
                          }}>
                            {r.symbol}
                          </Typography>
                          <Typography variant="caption" sx={{
                            color: "text.secondary"
                          }}>
                            {r.type} · {r.region} · {r.currency}
                          </Typography>
                        </Box>
                        <Typography variant="caption" noWrap sx={{
                          color: "text.secondary"
                        }}>
                          {r.name}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
            <TextField
              margin="dense"
              label="Ticker"
              name="ticker"
              value={form.ticker}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              margin="dense"
              label="Display Name"
              name="displayName"
              value={form.displayName}
              onChange={handleChange}
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
        title="Delete Ticker"
        message="Are you sure you want to delete this tracked ticker?"
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
      <TickerHistoryModal open={historyModalOpen} onClose={handleCloseHistory} ticker={selectedTicker || ''} />
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

export default TrackedTickersPage;
