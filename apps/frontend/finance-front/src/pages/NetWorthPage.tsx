import React, { useMemo, useState } from 'react';
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
  Collapse,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useTenantFilter } from '@tumbaland/components';
import { useSnapshots, useSaveSnapshot, useDeleteSnapshot } from '../hooks/useSnapshots';
import { useAssetClasses } from '../hooks/useAssetClasses';
import CheckInDialog from '../components/net-worth/CheckInDialog';
import AssetClassManagerDialog from '../components/net-worth/AssetClassManagerDialog';
import ConfirmationModal from '../components/ConfirmationModal';
import { Snapshot, SnapshotEntry } from '../types';
import { snapshotMonth } from '../services/snapshotService';
import { formatCurrency, formatPct } from '../utils/numberUtils';

const changeColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m is 0-based here, so this is month+1
  return d.toISOString().slice(0, 7);
}

const NetWorthPage: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { data: snapshots = [], isLoading, error } = useSnapshots(tenantGroupId);
  const { data: assetClasses = [] } = useAssetClasses(tenantGroupId);
  const saveMutation = useSaveSnapshot();
  const deleteMutation = useDeleteSnapshot();

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<Snapshot | null>(null);
  const [classManagerOpen, setClassManagerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const classById = useMemo(
    () => new Map(assetClasses.map((ac) => [ac._id, ac])),
    [assetClasses]
  );

  const isLiability = useMemo(
    () => (assetClassId: string) => classById.get(assetClassId)?.kind === 'liability',
    [classById]
  );

  // Liability entries are stored as positive magnitudes and subtracted here, so
  // the column really is net worth rather than gross assets.
  const netOf = useMemo(
    () => (s: Snapshot) =>
      s.entries.reduce((sum, e) => sum + (isLiability(e.assetClassId) ? -e.value : e.value), 0),
    [isLiability]
  );

  // Snapshots arrive sorted date desc from the API
  const rows = useMemo(() => {
    return snapshots.map((s, i) => {
      const total = netOf(s);
      const gain = s.entries.reduce((sum, e) => sum + e.gain, 0);
      const prev = snapshots[i + 1];
      const prevTotal = prev ? netOf(prev) : undefined;
      return {
        snapshot: s,
        month: snapshotMonth(s),
        total,
        gain,
        change: prevTotal !== undefined ? total - prevTotal : undefined,
        // A percentage against a zero or negative baseline is meaningless.
        changePct: prevTotal !== undefined && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : undefined
      };
    });
  }, [snapshots, netOf]);

  const latest = rows[0];

  const checkInPrefill = useMemo(() => {
    const source = editSnapshot || rows[0]?.snapshot;
    const map = new Map<string, { value: number; gain: number }>();
    source?.entries.forEach((e: SnapshotEntry) => map.set(e.assetClassId, { value: e.value, gain: e.gain }));
    return map;
  }, [editSnapshot, rows]);

  const defaultMonth = latest ? nextMonth(latest.month) : new Date().toISOString().slice(0, 7);

  const usedClassIds = useMemo(() => {
    const ids = new Set<string>();
    snapshots.forEach((s) => s.entries.forEach((e) => ids.add(e.assetClassId)));
    return ids;
  }, [snapshots]);

  const handleSave = async (month: string, entries: SnapshotEntry[]) => {
    await saveMutation.mutateAsync({ month, entries, groupId: tenantGroupId });
    setSnackbar({ message: `Check-in for ${month} saved`, severity: 'success' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      setSnackbar({ message: 'Check-in deleted', severity: 'success' });
    } catch {
      setSnackbar({ message: 'Failed to delete check-in', severity: 'error' });
    }
    setDeleteTarget(null);
  };

  const renderBreakdownChips = (snapshot: Snapshot) =>
    [...snapshot.entries]
      .sort((a, b) => b.value - a.value)
      .map((e) => {
        const ac = classById.get(e.assetClassId);
        const owed = ac?.kind === 'liability';
        return (
          <Chip
            key={e.assetClassId}
            size="small"
            sx={{ borderLeft: `4px solid ${ac?.color || '#667eea'}` }}
            label={
              `${ac?.name || 'Unknown'}: ${owed ? '−' : ''}${formatCurrency(e.value)}` +
              (!owed && e.gain ? ` (${e.gain > 0 ? '+' : ''}${formatCurrency(e.gain)} gain)` : '')
            }
          />
        );
      });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        <Alert severity="error">Failed to load net worth history</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Net Worth</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            One check-in per month: the value of every asset class
          </Typography>
        </Box>
        <Button startIcon={<CategoryIcon />} onClick={() => setClassManagerOpen(true)}>
          Asset classes
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditSnapshot(null); setCheckInOpen(true); }}>
          Add check-in
        </Button>
      </Box>

      {/* Summary */}
      {latest && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, minWidth: 200 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Net worth · {latest.month}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatCurrency(latest.total)}</Typography>
          </Paper>
          {latest.change !== undefined && (
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, minWidth: 200 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Change vs previous month</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: changeColor(latest.change) }}>
                {latest.change >= 0 ? '+' : ''}{formatCurrency(latest.change)}
                {latest.changePct !== undefined && (
                  <Typography component="span" variant="body1" sx={{ ml: 1, color: 'inherit' }}>
                    ({formatPct(latest.changePct)})
                  </Typography>
                )}
              </Typography>
            </Paper>
          )}
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, minWidth: 200 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total gain (latest check-in)</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: changeColor(latest.gain) }}>
              {latest.gain >= 0 ? '+' : ''}{formatCurrency(latest.gain)}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* History */}
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rows.map((row) => (
            <Paper
              key={row.snapshot._id}
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ cursor: 'pointer', flexGrow: 1 }} onClick={() => toggleExpand(row.snapshot._id)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Typography sx={{ fontWeight: 600 }}>{row.month}</Typography>
                    <IconButton size="small">
                      {expanded.has(row.snapshot._id) ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                    </IconButton>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatCurrency(row.total)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => { setEditSnapshot(row.snapshot); setCheckInOpen(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(row.snapshot)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Change</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: changeColor(row.change ?? 0) }}>
                    {row.change !== undefined ? `${row.change >= 0 ? '+' : ''}${formatCurrency(row.change)}` : '—'}
                    {row.changePct !== undefined && ` (${formatPct(row.changePct)})`}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total gain</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: changeColor(row.gain) }}>
                    {row.gain !== 0 ? `${row.gain >= 0 ? '+' : ''}${formatCurrency(row.gain)}` : '—'}
                  </Typography>
                </Box>
              </Box>
              <Collapse in={expanded.has(row.snapshot._id)} timeout="auto" unmountOnExit>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                  {renderBreakdownChips(row.snapshot)}
                </Box>
              </Collapse>
            </Paper>
          ))}
          {rows.length === 0 && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 4, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
                No check-ins yet
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Set up your asset classes, then add your first monthly check-in.
              </Typography>
            </Paper>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Month</TableCell>
                <TableCell align="right">Net worth</TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell align="right">Change %</TableCell>
                <TableCell align="right">Total gain</TableCell>
                <TableCell align="right" sx={{ width: 110 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <React.Fragment key={row.snapshot._id}>
                  <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggleExpand(row.snapshot._id)}>
                    <TableCell>
                      <IconButton size="small">
                        {expanded.has(row.snapshot._id) ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.month}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(row.total)}</TableCell>
                    <TableCell align="right" sx={{ color: changeColor(row.change ?? 0) }}>
                      {row.change !== undefined ? `${row.change >= 0 ? '+' : ''}${formatCurrency(row.change)}` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: changeColor(row.change ?? 0) }}>
                      {row.changePct !== undefined ? formatPct(row.changePct) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: changeColor(row.gain) }}>
                      {row.gain !== 0 ? `${row.gain >= 0 ? '+' : ''}${formatCurrency(row.gain)}` : '—'}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => { setEditSnapshot(row.snapshot); setCheckInOpen(true); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(row.snapshot)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                      <Collapse in={expanded.has(row.snapshot._id)} timeout="auto" unmountOnExit>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, py: 1.5, pl: 6 }}>
                          {renderBreakdownChips(row.snapshot)}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
                      No check-ins yet
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Set up your asset classes, then add your first monthly check-in.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CheckInDialog
        open={checkInOpen}
        onClose={() => { setCheckInOpen(false); setEditSnapshot(null); }}
        onSubmit={handleSave}
        assetClasses={assetClasses}
        editMonth={editSnapshot ? snapshotMonth(editSnapshot) : undefined}
        initialEntries={checkInPrefill}
        defaultMonth={defaultMonth}
        saving={saveMutation.isPending}
      />

      <AssetClassManagerDialog
        open={classManagerOpen}
        onClose={() => setClassManagerOpen(false)}
        assetClasses={assetClasses}
        tenantGroupId={tenantGroupId}
        isClassInUse={(id) => usedClassIds.has(id)}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete check-in"
        message={`Delete the check-in for ${deleteTarget ? snapshotMonth(deleteTarget) : ''}? This cannot be undone.`}
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

export default NetWorthPage;
