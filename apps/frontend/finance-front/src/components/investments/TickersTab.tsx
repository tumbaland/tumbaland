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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ShowChart as ShowChartIcon,
  CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { TrackedTicker } from '../../services/trackedTickerService';
import {
  useCreateTrackedTicker,
  useUpdateTrackedTicker,
  useDeleteTrackedTicker
} from '../../hooks/useTrackedTicker';
import { fetchAllTickerPriceHistory } from '../../services/tickerPriceHistoryService';
import ConfirmationModal from '../ConfirmationModal';
import TickerHistoryModal from '../TickerHistoryModal';
import TickerSearch from './TickerSearch';

interface TickersTabProps {
  tickers: TrackedTicker[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

interface TickerForm {
  ticker: string;
  displayName: string;
  description: string;
  isActive: boolean;
}

const emptyForm: TickerForm = { ticker: '', displayName: '', description: '', isActive: true };

/**
 * Instruments whose prices are fetched daily (19:00) from Alpha Vantage.
 * Tickers are added automatically when a holding is created; this tab is for
 * watching instruments you don't own yet and for pulling price history.
 */
const TickersTab: React.FC<TickersTabProps> = ({ tickers, tenantGroupId, notify }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const createMutation = useCreateTrackedTicker();
  const updateMutation = useUpdateTrackedTicker();
  const deleteMutation = useDeleteTrackedTicker();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TickerForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TrackedTicker | null>(null);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: TrackedTicker) => {
    setEditingId(t._id!);
    setForm({ ticker: t.ticker, displayName: t.displayName, description: t.description || '', isActive: t.isActive });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.ticker.trim() || !form.displayName.trim()) {
      notify('Ticker and display name are required', 'error');
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: { ...form } });
        notify('Ticker updated', 'success');
      } else {
        await createMutation.mutateAsync({ ...form, groupId: tenantGroupId });
        notify('Ticker added', 'success');
      }
      setDialogOpen(false);
    } catch {
      notify('Failed to save ticker', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id!);
      notify('Ticker deleted', 'success');
    } catch {
      notify('Failed to delete ticker', 'error');
    }
    setDeleteTarget(null);
  };

  const handleFetchHistory = async (ticker: string) => {
    setFetching(ticker);
    try {
      await fetchAllTickerPriceHistory(ticker);
      notify(`Price history fetched for ${ticker}`, 'success');
    } catch {
      notify(`Failed to fetch prices for ${ticker} — Alpha Vantage rate limit may be exhausted`, 'error');
    } finally {
      setFetching(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Active tickers get a daily price update at 19:00. Holdings track their ticker automatically.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Track ticker
        </Button>
      </Box>

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {tickers.map((t) => (
            <Paper key={t._id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{t.ticker}</Typography>
                    <Chip size="small" label={t.isActive ? 'Active' : 'Paused'} color={t.isActive ? 'success' : 'default'} />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.displayName}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Added</Typography>
                  <Typography variant="body2">{t.dateAdded ? t.dateAdded.slice(0, 10) : '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => setHistoryTicker(t.ticker)} title="Price history">
                    <ShowChartIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleFetchHistory(t.ticker)}
                    disabled={fetching !== null}
                    title="Fetch last ~100 days of prices now"
                  >
                    <CloudDownloadIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => openEdit(t)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(t)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          ))}
          {tickers.length === 0 && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 4, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No tracked tickers — add a holding or track a ticker to start collecting prices.
              </Typography>
            </Paper>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ticker</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Added</TableCell>
                <TableCell align="right" sx={{ width: 170 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickers.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{t.ticker}</TableCell>
                  <TableCell>{t.displayName}</TableCell>
                  <TableCell>
                    <Chip size="small" label={t.isActive ? 'Active' : 'Paused'} color={t.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>{t.dateAdded ? t.dateAdded.slice(0, 10) : '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setHistoryTicker(t.ticker)} title="Price history">
                      <ShowChartIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleFetchHistory(t.ticker)}
                      disabled={fetching !== null}
                      title="Fetch last ~100 days of prices now"
                    >
                      <CloudDownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openEdit(t)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(t)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {tickers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      No tracked tickers — add a holding or track a ticker to start collecting prices.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit ticker' : 'Track ticker'}</DialogTitle>
        <DialogContent>
          {!editingId && (
            <Box sx={{ mb: 2, mt: 1 }}>
              <TickerSearch onSelect={(r) => setForm((f) => ({ ...f, ticker: r.symbol, displayName: r.name }))} />
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={!!deleteTarget}
        title="Stop tracking ticker"
        message={`Stop tracking ${deleteTarget?.ticker}? Its saved price history is kept.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {historyTicker && (
        <TickerHistoryModal open={!!historyTicker} onClose={() => setHistoryTicker(null)} ticker={historyTicker} />
      )}
    </Box>
  );
};

export default TickersTab;
