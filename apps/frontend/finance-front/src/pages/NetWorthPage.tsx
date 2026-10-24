import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
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
import { useTenantFilter, ConfirmationModal } from '@tumbaland/frontend-core';
import { useSnapshots, useSaveSnapshot, useDeleteSnapshot } from '../hooks/useSnapshots';
import { useAssetClasses } from '../hooks/useAssetClasses';
import CheckInDialog from '../components/net-worth/CheckInDialog';
import AssetClassManagerDialog from '../components/net-worth/AssetClassManagerDialog';
import { Snapshot, SnapshotEntry } from '../types';
import { snapshotMonth } from '../services/snapshotService';
import { formatCurrency, formatPct } from '../utils/numberUtils';

const changeColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

const signed = (v: number) => `${v >= 0 ? '+' : ''}${formatCurrency(v)}`;

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m is 0-based here, so this is month+1
  return d.toISOString().slice(0, 7);
}

const statLabelSx = { color: 'text.secondary', fontSize: { xs: '0.78rem', md: '0.875rem' } };

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

  const openEdit = (snapshot: Snapshot) => {
    setEditSnapshot(snapshot);
    setCheckInOpen(true);
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
            sx={{ borderLeft: `4px solid ${ac?.color || '#667eea'}`, maxWidth: '100%' }}
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
      <Box sx={{ py: 3 }}>
        <Alert severity="error">Failed to load net worth history</Alert>
      </Box>
    );
  }

  const emptyState = (
    <>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
        No check-ins yet
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Set up your asset classes, then add your first monthly check-in.
      </Typography>
    </>
  );

  return (
    // No side padding on a phone: the layout's container already has a gutter,
    // and the two together cost every card 32px of width.
    <Box sx={{ px: { xs: 0, md: 4 }, py: { xs: 1.5, md: 4 } }}>
      {/* Title and both actions on one row. On a phone the class manager is an
          icon: it is set up once and rarely revisited, while a check-in is
          added every month. */}
      <Box sx={{ mb: { xs: 1.5, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, fontSize: { xs: '1.4rem', md: '2.125rem' } }}
          >
            Net Worth
          </Typography>
          <Button
            startIcon={<CategoryIcon />}
            onClick={() => setClassManagerOpen(true)}
            aria-label="Asset classes"
            size={isMobile ? 'small' : 'medium'}
            sx={{ minWidth: 0, flexShrink: 0, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Asset classes
            </Box>
          </Button>
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            size={isMobile ? 'small' : 'medium'}
            onClick={() => { setEditSnapshot(null); setCheckInOpen(true); }}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Add check-in
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, fontSize: { xs: '0.82rem', md: '1rem' } }}>
          One check-in per month: the value of every asset class
        </Typography>
      </Box>

      {/* One summary card rather than three: on a phone the net worth leads on
          its own line and the two changes share the line under it. */}
      {latest && (
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: { xs: 1.75, md: 2.5 },
            mb: { xs: 1.5, md: 3 },
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 3 }
          }}
        >
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Typography variant="body2" sx={statLabelSx}>Net worth · {latest.month}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '1.5rem' } }}>
              {formatCurrency(latest.total)}
            </Typography>
          </Box>
          {latest.change !== undefined && (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={statLabelSx}>Change vs previous month</Typography>
              <Typography
                variant="h5"
                sx={{ fontWeight: 700, color: changeColor(latest.change), fontSize: { xs: '1.05rem', md: '1.5rem' } }}
              >
                {signed(latest.change)}
                {latest.changePct !== undefined && (
                  <Typography component="span" variant="body1" sx={{ ml: 0.75, color: 'inherit', fontSize: '0.8em' }}>
                    ({formatPct(latest.changePct)})
                  </Typography>
                )}
              </Typography>
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={statLabelSx}>Total gain (latest check-in)</Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: changeColor(latest.gain), fontSize: { xs: '1.05rem', md: '1.5rem' } }}
            >
              {signed(latest.gain)}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* History */}
      {isMobile ? (
        // One grouped list, a row per month: the month and its change on the
        // left, the total on the right. The breakdown, the gain and the edit and
        // delete actions open under a row when it is tapped. As separate cards
        // with the actions always showing, three months filled a screen.
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          {rows.map((row, index) => {
            const open = expanded.has(row.snapshot._id);
            return (
              <Box
                key={row.snapshot._id}
                sx={{ borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider' }}
              >
                <ButtonBase
                  onClick={() => toggleExpand(row.snapshot._id)}
                  aria-expanded={open}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 1,
                    px: 1.75,
                    py: 1.1,
                    textAlign: 'left'
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.3 }}>{row.month}</Typography>
                    <Typography
                      noWrap
                      sx={{ fontSize: '0.78rem', fontWeight: 600, color: changeColor(row.change ?? 0) }}
                    >
                      {row.change !== undefined
                        ? `${signed(row.change)}${row.changePct !== undefined ? ` · ${formatPct(row.changePct)}` : ''}`
                        : 'First check-in'}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                    {formatCurrency(row.total)}
                  </Typography>
                  {open ? (
                    <KeyboardArrowUp fontSize="small" sx={{ color: 'text.secondary' }} />
                  ) : (
                    <KeyboardArrowDown fontSize="small" sx={{ color: 'text.secondary' }} />
                  )}
                </ButtonBase>
                <Collapse in={open} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 1.75, pb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      Total gain{' '}
                      <Box component="span" sx={{ fontWeight: 600, color: changeColor(row.gain) }}>
                        {row.gain !== 0 ? signed(row.gain) : '—'}
                      </Box>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                      {renderBreakdownChips(row.snapshot)}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.25 }}>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row.snapshot)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteTarget(row.snapshot)}>
                        Delete
                      </Button>
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
          {rows.length === 0 && <Box sx={{ p: 4, textAlign: 'center' }}>{emptyState}</Box>}
        </Paper>
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
                      {row.change !== undefined ? signed(row.change) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: changeColor(row.change ?? 0) }}>
                      {row.changePct !== undefined ? formatPct(row.changePct) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: changeColor(row.gain) }}>
                      {row.gain !== 0 ? signed(row.gain) : '—'}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => openEdit(row.snapshot)}>
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
                    {emptyState}
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
