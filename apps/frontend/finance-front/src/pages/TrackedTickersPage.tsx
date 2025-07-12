import React, { useEffect, useState } from 'react';
import {
  getTrackedTickers,
  addTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker,
  TrackedTicker
} from '../services/trackedTickerService';
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
  Tooltip
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import ConfirmationModal from '../components/ConfirmationModal';
import TickerHistoryModal from '../components/TickerHistoryModal';

const defaultForm: Omit<TrackedTicker, '_id' | 'dateAdded'> = {
  ticker: '',
  displayName: '',
  description: '',
  isActive: true
};

const TrackedTickersPage: React.FC = () => {
  const [tickers, setTickers] = useState<TrackedTicker[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const fetchTickers = async () => {
    try {
      const data = await getTrackedTickers();
      setTickers(Array.isArray(data) ? data : []);
    } catch {
      setTickers([]);
      setError('Failed to load tickers');
    }
  };

  useEffect(() => {
    fetchTickers();
  }, []);

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
    setError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateTrackedTicker(editingId, form);
      } else {
        await addTrackedTicker(form);
      }
      fetchTickers();
      handleCloseDialog();
    } catch {
      setError('Failed to save ticker');
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteTrackedTicker(pendingDeleteId);
      fetchTickers();
    } catch {
      setError('Failed to delete ticker');
    } finally {
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
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
      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <Table
          stickyHeader
          size="small"
          sx={{
            minWidth: 400,
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
            {tickers.map((t, idx) => (
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
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Ticker' : 'Add Ticker'}</DialogTitle>
          <DialogContent>
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
            {error && <Typography color="error">{error}</Typography>}
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
    </Box>
  );
};

export default TrackedTickersPage;
