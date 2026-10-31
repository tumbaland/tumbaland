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
import { UsageMeter, ConfirmationModal, paywallMessage } from '@tumbaland/frontend-core';
import { TrackedTicker } from '../../services/trackedTickerService';
import {
  useCreateTrackedTicker,
  useUpdateTrackedTicker,
  useDeleteTrackedTicker
} from '../../hooks/useTrackedTicker';
import TickerHistoryModal from '../TickerHistoryModal';
import TickerFormDialog, { TickerForm, emptyTickerForm } from './TickerFormDialog';
import DataSyncDialog from './DataSyncDialog';
import { useTickerSync } from '../../hooks/useTickerSync';

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
  const [form, setForm] = useState<TickerForm>(emptyTickerForm);
  const [deleteTarget, setDeleteTarget] = useState<TrackedTicker | null>(null);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);
  const { quota, coverage, refreshCoverage, syncTicker, setSyncTicker, busyAction, handleSync, lastUpdated } = useTickerSync(notify);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyTickerForm);
    setDialogOpen(true);
  };

  const openEdit = (t: TrackedTicker) => {
    setEditingId(t._id!);
    setForm({
      ticker: t.ticker,
      displayName: t.displayName,
      currency: t.currency || '',
      isin: t.isin || '',
      description: t.description || '',
      isActive: t.isActive
    });
    setDialogOpen(true);
  };

  // The symbol as saved, so the dialog can say what a change to it will do: the
  // server carries price history, holdings and trades over to the new symbol.
  const savedSymbol = editingId ? tickers.find((t) => t._id === editingId)?.ticker : undefined;
  const renaming = !!savedSymbol && !!form.ticker.trim() && form.ticker !== savedSymbol;

  const handleSubmit = async () => {
    if (!form.ticker.trim() || !form.displayName.trim()) {
      notify('Ticker and display name are required', 'error');
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: { ...form } });
        if (renaming) {
          notify(`Renamed ${savedSymbol} to ${form.ticker}`, 'success');
          // Coverage is keyed by symbol, so the row would read as empty until reload.
          refreshCoverage();
        } else {
          notify('Ticker updated', 'success');
        }
      } else {
        await createMutation.mutateAsync({ ...form, groupId: tenantGroupId });
        notify('Ticker added', 'success');
      }
      setDialogOpen(false);
    } catch (err) {
      // A plan limit is not a failure — name it, or the paywall reads as a bug.
      // A conflict says which symbol is in the way, which the generic line would hide.
      const isConflict = (err as { status?: number })?.status === 409;
      notify(paywallMessage(err, isConflict ? (err as Error).message : 'Failed to save ticker'), 'error');
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

  const rowActions = (t: TrackedTicker) => (
    <>
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
    </>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Active tickers get a daily price update at 04:00 UTC, the morning after each session —
            the provider publishes some symbols hours late. Holdings track their ticker automatically.
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
                  {(() => {
                    const state = lastUpdated(t.ticker);
                    return (
                      <>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last fetch</Typography>
                        <Typography variant="body2">{state?.fetchedAt ?? '—'}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                          Latest close
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: state?.stale ? 'warning.main' : 'text.primary' }}
                        >
                          {state ? (state.date ?? 'no data') : '—'}
                        </Typography>
                      </>
                    );
                  })()}
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  {rowActions(t)}
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
                <TableCell>Last fetch</TableCell>
                <TableCell>Latest close</TableCell>
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
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {lastUpdated(t.ticker)?.fetchedAt ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const state = lastUpdated(t.ticker);
                      if (!state) return '—';
                      return (
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: 'nowrap',
                            color: state.stale ? 'warning.main' : 'text.primary',
                            fontWeight: state.stale ? 600 : 400
                          }}
                        >
                          {state.date ?? 'no data'}
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
                    {rowActions(t)}
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

      <TickerFormDialog
        open={dialogOpen}
        editing={!!editingId}
        form={form}
        setForm={setForm}
        renamingFrom={renaming ? savedSymbol : undefined}
        submitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
        onClose={() => setDialogOpen(false)}
      />

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
