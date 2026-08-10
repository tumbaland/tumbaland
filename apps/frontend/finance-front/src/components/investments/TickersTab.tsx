import React, { useEffect, useState } from 'react';
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
  Sync as SyncIcon
} from '@mui/icons-material';
import { UsageMeter } from '@tumbaland/components';
import { TrackedTicker } from '../../services/trackedTickerService';
import { paywallMessage } from '../../utils/paywall';
import {
  useCreateTrackedTicker,
  useUpdateTrackedTicker,
  useDeleteTrackedTicker
} from '../../hooks/useTrackedTicker';
import {
  fetchAllTickerPriceHistory,
  fetchTickerPriceHistory,
  fetchWeeklyTickerPriceHistory,
  getQuota,
  getTickerCoverage,
  QuotaStatus,
  TickerCoverage
} from '../../services/tickerPriceHistoryService';
import ConfirmationModal from '../ConfirmationModal';
import TickerHistoryModal from '../TickerHistoryModal';
import TickerSearch from './TickerSearch';
import DataSyncDialog, { SyncAction, freshnessLabel, isStale } from './DataSyncDialog';

interface TickersTabProps {
  tickers: TrackedTicker[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
  /**
   * The plan's ceiling on tracked tickers, `-1` for unlimited, or `undefined`
   * when entitlements could not be loaded — in which case no meter is drawn.
   */
  tickerLimit?: number;
  /**
   * Symbols billed to the account. Not `tickers.length`: the meter counts
   * distinct active symbols across everything the account pays for, which for a
   * group is the owner's whole pool, while the table shows one context.
   */
  meteredTickers?: number;
  onUpgrade?: () => void;
}

interface TickerForm {
  ticker: string;
  displayName: string;
  currency: string;
  description: string;
  isActive: boolean;
}

const emptyForm: TickerForm = { ticker: '', displayName: '', currency: '', description: '', isActive: true };

/**
 * Instruments whose prices are fetched daily (19:00) from Alpha Vantage.
 * Tickers are added automatically when a holding is created; this tab is for
 * watching instruments you don't own yet and for pulling price history.
 */
const TickersTab: React.FC<TickersTabProps> = ({
  tickers,
  tenantGroupId,
  notify,
  tickerLimit,
  meteredTickers,
  onUpgrade
}) => {
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
  const [syncTicker, setSyncTicker] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<SyncAction | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: TrackedTicker) => {
    setEditingId(t._id!);
    setForm({
      ticker: t.ticker,
      displayName: t.displayName,
      currency: t.currency || '',
      description: t.description || '',
      isActive: t.isActive
    });
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
    } catch (err) {
      // A plan limit is not a failure — name it, or the paywall reads as a bug.
      notify(paywallMessage(err, 'Failed to save ticker'), 'error');
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

  // The provider's daily quota is shared by everyone on this deployment, so
  // showing what is left turns "it failed, try again" into "there are no calls
  // left today".
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [coverage, setCoverage] = useState<Record<string, TickerCoverage>>({});

  const refreshQuota = () => { getQuota().then(setQuota).catch(() => setQuota(null)); };
  const refreshCoverage = () => {
    getTickerCoverage()
      .then(rows => setCoverage(Object.fromEntries(rows.map(r => [r.ticker, r]))))
      // Coverage is decoration on a table that works without it; a failed
      // lookup leaves the column blank rather than breaking the page.
      .catch(() => setCoverage({}));
  };

  useEffect(() => {
    refreshQuota();
    refreshCoverage();
  }, []);

  /**
   * One handler for all three, because they differ only in which call they make
   * and what they report — and the surrounding concerns (which action is busy,
   * refreshing quota and coverage afterwards, turning a provider rejection into
   * a sentence) are identical and were previously duplicated per button.
   */
  const handleSync = async (action: SyncAction) => {
    if (!syncTicker) return;
    setBusyAction(action);
    try {
      if (action === 'latest') {
        await fetchTickerPriceHistory(syncTicker);
        notify(`Latest price fetched for ${syncTicker}`, 'success');
      } else if (action === 'daily') {
        await fetchAllTickerPriceHistory(syncTicker);
        notify(`Daily price history fetched for ${syncTicker}`, 'success');
      } else {
        const result = await fetchWeeklyTickerPriceHistory(syncTicker);
        notify(`Fetched ${result.recordsCount} weekly closes for ${syncTicker}`, 'success');
      }
    } catch {
      notify(
        `Failed to sync ${syncTicker} — the shared Alpha Vantage allowance may be exhausted for today`,
        'error'
      );
    } finally {
      setBusyAction(null);
      refreshQuota();
      refreshCoverage();
    }
  };

  /** Freshness of the daily series, as the table's own summary of sync state. */
  const lastUpdated = (ticker: string) => {
    const c = coverage[ticker];
    if (!c) return null;
    const hasHistory = c.daily.count > 0 || c.weekly.count > 0;
    return {
      label: hasHistory ? freshnessLabel(c.daily.last ?? c.weekly.last) : 'no data',
      stale: hasHistory ? isStale(c.daily.last, 'daily') : true,
      weeklyYears:
        c.weekly.first && c.weekly.last
          ? (Date.parse(c.weekly.last) - Date.parse(c.weekly.first)) / (365.25 * 86_400_000)
          : 0
    };
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Active tickers get a daily price update at 19:00. Holdings track their ticker automatically.
          </Typography>
          {quota && (
            <Typography
              variant="caption"
              sx={{ color: quota.remaining === 0 ? 'error.main' : 'text.secondary' }}
            >
              {quota.remaining} of {quota.limit} Alpha Vantage calls left today
              {quota.remaining === 0 && ' — fetches will fail until 00:00 UTC'}
            </Typography>
          )}
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Track ticker
        </Button>
      </Box>

      {/*
        Beside the button it gates. Each tracked symbol spends from the
        deployment-wide market-data budget, so this is the limit most likely to
        stop a write — and a ceiling nobody can see turns a 402 into a bug
        report.
      */}
      {tickerLimit !== undefined && (
        <Box sx={{ mb: 2, maxWidth: 420 }}>
          <UsageMeter
            label="Tracked tickers"
            used={meteredTickers ?? tickers.length}
            limit={tickerLimit}
            unit="count"
            onUpgrade={onUpgrade}
            upgradeLabel="See plans"
          />
        </Box>
      )}

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
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Prices updated</Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: lastUpdated(t.ticker)?.stale ? 'warning.main' : 'text.primary' }}
                  >
                    {lastUpdated(t.ticker)?.label ?? '—'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => setHistoryTicker(t.ticker)} title="Price history">
                    <ShowChartIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setSyncTicker(t.ticker)} title="Price data & sync">
                    <SyncIcon fontSize="small" />
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
                <TableCell>Currency</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Prices updated</TableCell>
                <TableCell>Long history</TableCell>
                <TableCell align="right" sx={{ width: 150 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickers.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{t.ticker}</TableCell>
                  <TableCell>{t.displayName}</TableCell>
                  <TableCell>{t.currency || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={t.isActive ? 'Active' : 'Paused'} color={t.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const state = lastUpdated(t.ticker);
                      if (!state) return '—';
                      return (
                        <Typography
                          variant="body2"
                          sx={{ color: state.stale ? 'warning.main' : 'text.primary', fontWeight: state.stale ? 600 : 400 }}
                        >
                          {state.label}
                        </Typography>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {/*
                      The planner's risk estimate is only as good as the longest
                      history every holding shares, and on the free provider tier
                      that depth exists only if someone fetched the weekly series.
                      Surfacing it here is what makes the gap actionable.
                    */}
                    {(() => {
                      const years = lastUpdated(t.ticker)?.weeklyYears ?? 0;
                      return years >= 0.5 ? (
                        <Chip size="small" color="success" variant="outlined" label={`${years.toFixed(1)} yrs`} />
                      ) : (
                        <Chip size="small" label="not fetched" onClick={() => setSyncTicker(t.ticker)} />
                      );
                    })()}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setHistoryTicker(t.ticker)} title="Price history">
                      <ShowChartIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setSyncTicker(t.ticker)} title="Price data & sync">
                      <SyncIcon fontSize="small" />
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
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
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
            label="Currency"
            fullWidth
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))}
            placeholder="EUR"
            helperText="Currency this instrument is quoted in — used to convert its prices into your base currency."
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

      <DataSyncDialog
        open={!!syncTicker}
        ticker={syncTicker}
        displayName={tickers.find(t => t.ticker === syncTicker)?.displayName}
        dateAdded={tickers.find(t => t.ticker === syncTicker)?.dateAdded}
        coverage={syncTicker ? coverage[syncTicker] : undefined}
        quota={quota}
        busy={busyAction}
        onSync={handleSync}
        onClose={() => setSyncTicker(null)}
      />
    </Box>
  );
};

export default TickersTab;
