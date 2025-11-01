import React, { useEffect, useMemo, useState } from 'react';
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
  TableSortLabel,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  Collapse,
  IconButton
} from '@mui/material';
import { Add, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import ConfirmationModal from '../components/ConfirmationModal';
import { useTenantFilter } from '../components/tenant';
import AssetAllocationModal from '../components/AssetAllocationModal';
import {
  useAssetAllocations,
  useAssetClasses,
  useCreateAssetAllocation,
  useUpdateAssetAllocation,
  useDeleteAssetAllocation
} from '../hooks/useAsset';
import { AssetAllocation, AssetClass } from '../types';

const AssetAllocationPage: React.FC = () => {
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context

  // React Query hooks
  const { data: allocations = [], isLoading: loading, error } = useAssetAllocations(tenantGroupId);
  const { data: assetClasses = [] } = useAssetClasses(tenantGroupId);
  const createMutation = useCreateAssetAllocation();
  const updateMutation = useUpdateAssetAllocation();
  const deleteMutation = useDeleteAssetAllocation();

  // UI state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    assetClassId: '',
    totalValue: '',
    gain: '',
    date: '',
    groupId: undefined as string | undefined
  });
  const [editForm, setEditForm] = useState({
    assetClassId: '',
    totalValue: '',
    gain: '',
    date: '',
    groupId: undefined as string | undefined
  });
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickRange, setQuickRange] = useState<string>(''); // e.g. '1M', '6M', '1Y'

  // Success/Error notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Initialize date filters when allocations load
  useEffect(() => {
    if (allocations && allocations.length) {
      const dates = allocations.map((a: AssetAllocation) => new Date(a.date)).filter((d: Date) => !isNaN(d.getTime()));
      if (dates.length) {
        const max = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
        const min = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
        const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        if (!endDate) setEndDate(iso(max));
        if (!startDate) {
          // default to last 6 months but not before earliest
          const sixMonthsAgo = new Date(max);
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const start = sixMonthsAgo < min ? min : sixMonthsAgo;
          setStartDate(iso(start));
          setQuickRange('6M');
        }
      }
    }
  }, [allocations, startDate, endDate]);

  // Handle mutation success/error
  useEffect(() => {
    if (createMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Asset allocation created successfully', severity: 'success' });
      createMutation.reset();
    }
    if (createMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to create asset allocation', severity: 'error' });
      createMutation.reset();
    }
  }, [createMutation.isSuccess, createMutation.isError]);

  useEffect(() => {
    if (updateMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Asset allocation updated successfully', severity: 'success' });
      updateMutation.reset();
    }
    if (updateMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to update asset allocation', severity: 'error' });
      updateMutation.reset();
    }
  }, [updateMutation.isSuccess, updateMutation.isError]);

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Asset allocation deleted successfully', severity: 'success' });
      deleteMutation.reset();
    }
    if (deleteMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to delete asset allocation', severity: 'error' });
      deleteMutation.reset();
    }
  }, [deleteMutation.isSuccess, deleteMutation.isError]);

  // Helper to format date for table display (DD.MM.YYYY)
  function formatDate(date: string | Date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Inline helper for local YYYY-MM-DD
  function toLocalInputDate(date: string | Date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  }

  const handleCreateOpen = () => {
    setCreateForm({
      assetClassId: '',
      totalValue: '',
      gain: '',
      date: toLocalInputDate(new Date()),
      groupId: tenantGroupId // Prefill with active tenant
    });
    setCreateOpen(true);
  };
  const handleCreateClose = () => setCreateOpen(false);
  const handleEditOpen = (allocation: AssetAllocation) => {
    setEditId(allocation._id);
    setEditForm({
      assetClassId: typeof allocation.assetClassId === 'string' ? allocation.assetClassId : allocation.assetClassId._id,
      totalValue: allocation.totalValue?.toString() || '',
      gain: allocation.gain?.toString() || '',
      date: toLocalInputDate(allocation.date),
      groupId: allocation.groupId
    });
    setEditOpen(true);
  };
  const handleEditClose = () => setEditOpen(false);

  const handleCreateSubmit = async (form: any) => {
    const payload = {
      ...form,
      totalValue: Number(form.totalValue),
      gain: Number(form.gain),
      groupId: tenantGroupId // Use tenant context for groupId
    };
    await createMutation.mutateAsync(payload);
    setCreateOpen(false);
  };
  const handleEditSubmit = async (form: any) => {
    if (!editId) return;
    const payload = {
      ...form,
      totalValue: Number(form.totalValue),
      gain: Number(form.gain)
    };
    await updateMutation.mutateAsync({ id: editId, data: payload });
    setEditOpen(false);
  };

  // Replace handleDelete with confirmation logic
  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeleteId(null);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleRowExpand = (dateKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedRows(newExpanded);
  };

  // Helper to format numbers with thousands separator and two decimals
  function formatNumber(value: number | string) {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Helper to get asset class name
  function getAssetClassName(allocation: AssetAllocation): string {
    if (typeof allocation.assetClassId === 'string') {
      const assetClass = assetClasses.find((ac: AssetClass) => ac._id === allocation.assetClassId);
      return assetClass?.name || 'Unknown';
    }
    return allocation.assetClassId.name;
  }

  // Filter allocations by search term
  const filteredAllocations = useMemo(() => {
    if (!searchTerm) return allocations;
    return allocations.filter((allocation: AssetAllocation) => {
      const assetClassName = getAssetClassName(allocation).toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      return assetClassName.includes(searchLower) ||
             allocation.totalValue?.toString().includes(searchLower) ||
             allocation.gain?.toString().includes(searchLower);
    });
  }, [allocations, searchTerm, assetClasses]);

  // Filter allocations by date range
  const dateFilteredAllocations = useMemo(() => {
    if (!startDate && !endDate) return filteredAllocations;
    const startTs = startDate ? new Date(startDate).getTime() : -Infinity;
    const endTs = endDate ? new Date(endDate).getTime() + 24*60*60*1000 - 1 : Infinity; // inclusive end day
    return filteredAllocations.filter((a: AssetAllocation) => {
      const ts = new Date(a.date).getTime();
      return !isNaN(ts) && ts >= startTs && ts <= endTs;
    });
  }, [filteredAllocations, startDate, endDate]);

  // Helper to get date key (YYYY-MM-DD) ignoring time
  function getDateKey(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10); // YYYY-MM-DD format
  }

  // Group allocations by date and calculate totals
  const groupedAllocations = useMemo(() => {
    const groups: { [dateKey: string]: { date: Date; allocations: AssetAllocation[]; totalValue: number; totalGain: number } } = {};

    dateFilteredAllocations.forEach((allocation: AssetAllocation) => {
      const dateKey = getDateKey(allocation.date);
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: new Date(allocation.date),
          allocations: [],
          totalValue: 0,
          totalGain: 0
        };
      }
      groups[dateKey].allocations.push(allocation);
      groups[dateKey].totalValue += allocation.totalValue || 0;
      groups[dateKey].totalGain += allocation.gain || 0;
    });

    return Object.values(groups);
  }, [dateFilteredAllocations]);

  // Create chronologically sorted allocations for change calculation
  const chronoSortedAllocations = useMemo(() => {
    return [...groupedAllocations].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [groupedAllocations]);

  // Sort grouped allocations
  const sortedGroupedAllocations = useMemo(() => {
    return [...groupedAllocations].sort((a, b) => {
      let aVal: any, bVal: any;

      if (sortBy === 'date') {
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      } else if (sortBy === 'totalValue') {
        aVal = a.totalValue;
        bVal = b.totalValue;
      } else if (sortBy === 'totalGain') {
        aVal = a.totalGain;
        bVal = b.totalGain;
      } else if (sortBy === 'change') {
        // Calculate change for sorting (actual values, can be negative)
        const aIndex = chronoSortedAllocations.findIndex(item => item.date.getTime() === a.date.getTime());
        const bIndex = chronoSortedAllocations.findIndex(item => item.date.getTime() === b.date.getTime());
        const aPrevIndex = aIndex - 1;
        const bPrevIndex = bIndex - 1;
        const aChange = aPrevIndex >= 0 ? a.totalValue - chronoSortedAllocations[aPrevIndex].totalValue : 0;
        const bChange = bPrevIndex >= 0 ? b.totalValue - chronoSortedAllocations[bPrevIndex].totalValue : 0;
        aVal = aChange;
        bVal = bChange;
      } else {
        // For other columns, sort by date as fallback
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [groupedAllocations, sortBy, sortOrder, chronoSortedAllocations]);

  // Summary computation (net worth change across period)
  const summary = useMemo(() => {
    if (!sortedGroupedAllocations.length) return null;
    // sort ascending by date for period endpoints
    const byDateAsc = [...sortedGroupedAllocations].sort((a, b) => a.date.getTime() - b.date.getTime());
    const first = byDateAsc[0];
    const last = byDateAsc[byDateAsc.length - 1];
    const firstNet = first.totalValue;
    const lastNet = last.totalValue;
    const diff = lastNet - firstNet;
    const pct = firstNet !== 0 ? (diff / firstNet) * 100 : 0;
    return { first, last, firstNet, lastNet, diff, pct };
  }, [sortedGroupedAllocations]);

  // Quick range handlers
  const applyQuickRange = (range: string) => {
    const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    let effectiveEnd = endDate;
    if (!effectiveEnd) {
      // Derive latest allocation date as baseline if endDate was cleared via reset
      const maxDate = allocations
        .map((a: AssetAllocation) => new Date(a.date))
        .filter((d: Date) => !isNaN(d.getTime()))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
      if (!maxDate) return; // no allocations
      effectiveEnd = iso(maxDate);
      setEndDate(effectiveEnd);
    }
    const start = new Date(effectiveEnd);
    if (range === '1M') start.setMonth(start.getMonth() - 1);
    else if (range === '6M') start.setMonth(start.getMonth() - 6);
    else if (range === '1Y') start.setFullYear(start.getFullYear() - 1);
    else if (range === '2Y') start.setFullYear(start.getFullYear() - 2);
    else if (range === '3Y') start.setFullYear(start.getFullYear() - 3);
    else if (range === 'YTD') { start.setMonth(0, 1); }
    setStartDate(iso(start));
    setQuickRange(range);
  };

  const clearQuickRange = () => setQuickRange('');

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: { xs: 2, sm: 2.5, md: 3 },
        flexWrap: 'wrap',
        gap: { xs: 1, sm: 1.5, md: 2 },
        minHeight: { xs: 'auto', sm: 56, md: 64 }
      }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem', lg: '2.25rem' },
            flex: { xs: '1 1 100%', sm: '0 1 auto' },
            minWidth: 0,
            mr: { xs: 0, sm: 2 }
          }}
        >
          Asset Allocations
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{
            bgcolor: 'primary.main',
            fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' },
            px: { xs: 1.5, sm: 2, md: 2.5 },
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            minWidth: { xs: '100%', sm: 'auto' },
            whiteSpace: 'nowrap'
          }}
          onClick={handleCreateOpen}
        >
          Add Allocation
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: { xs: 1, sm: 1.5, md: 2 }, mb: 2 }} variant="outlined">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5, md: 2, lg: 2.5 }, alignItems: 'center' }}>
          <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: '120px', md: '140px', lg: '160px' }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            <Box component="span" sx={{ position: 'absolute', top: 4, left: 8, fontSize: { xs: 10, sm: 11 }, fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', pointerEvents: 'none', textTransform: 'uppercase' }}>From</Box>
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); clearQuickRange(); }}
              style={{ padding: '20px 8px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, width: '100%', minWidth: 100 }}
            />
          </Box>
          <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: '120px', md: '140px', lg: '160px' }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            <Box component="span" sx={{ position: 'absolute', top: 4, left: 8, fontSize: { xs: 10, sm: 11 }, fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', pointerEvents: 'none', textTransform: 'uppercase' }}>To</Box>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); }}
              style={{ padding: '20px 8px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, width: '100%', minWidth: 100 }}
            />
          </Box>
                    <Box sx={{
            display: 'flex',
            gap: { xs: 0.25, sm: 0.5, md: 1 },
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'center', sm: 'flex-start' },
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            order: { xs: -1, sm: 0 }
          }}>
            <Button size="small" variant={quickRange === '1M' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('1M')} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>1M</Button>
            <Button size="small" variant={quickRange === '6M' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('6M')} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>6M</Button>
            <Button size="small" variant={quickRange === 'YTD' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('YTD')} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>YTD</Button>
            <Button size="small" variant={quickRange === '1Y' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('1Y')} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>1Y</Button>
            <Button size="small" variant={quickRange === '2Y' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('2Y')} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>2Y</Button>
            <Button size="small" variant={quickRange === '3Y' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('3Y')} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>3Y</Button>
            <Button size="small" onClick={() => { setStartDate(''); setEndDate(''); clearQuickRange(); }} disabled={!startDate && !endDate} sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' }, px: { xs: 0.75, sm: 1 }, py: { xs: 0.25, sm: 0.5 }, minWidth: { xs: 'auto', sm: 50 }, minHeight: { xs: 28, sm: 32 } }}>Reset</Button>
          </Box>
          {quickRange && (
            <Typography variant="caption" color="text.secondary" sx={{ width: { xs: '100%', sm: 'auto' }, textAlign: { xs: 'center', sm: 'left' }, fontSize: { xs: '0.75rem', sm: '0.8125rem' }, flex: { xs: '1 1 100%', sm: '0 0 auto' }, order: { xs: -2, sm: 0 } }}>Quick range active: {quickRange}</Typography>
          )}
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: { xs: '100%', sm: 180, md: 220, lg: 260 },
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
              maxWidth: { xs: '100%', sm: 250, md: 300, lg: 350 },
              order: { xs: -3, sm: 0 },
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.8125rem', sm: '0.875rem' }
              }
            }}
          />
          <Box sx={{ flexGrow: 1, minWidth: { xs: 0, sm: 20, md: 40 } }} />
          <Typography variant="body2" color="text.secondary" sx={{
            width: { xs: '100%', sm: 'auto' },
            textAlign: { xs: 'center', sm: 'right' },
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            whiteSpace: 'nowrap',
            order: { xs: -4, sm: 0 }
          }}>
            Showing {sortedGroupedAllocations.length} date{sortedGroupedAllocations.length === 1 ? '' : 's'} with allocations
          </Typography>
        </Box>
      </Paper>
            {/* Summary (net worth change) */}
      <Paper sx={{ mb: 2, p: { xs: 1.5, sm: 2, md: 2.5 } }} variant="outlined">
        {summary ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '1rem' } }}>
              Portfolio Value Change {quickRange ? `(${quickRange})` : startDate || endDate ? ' (Filtered Period)' : ''}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.5, fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' } }}>
              From <strong>{formatDate(summary.first.date)}</strong> at <strong>{formatNumber(summary.firstNet)}</strong> to <strong>{formatDate(summary.last.date)}</strong> at <strong>{formatNumber(summary.lastNet)}</strong>.
              {' '}Change: <strong style={{ color: summary.diff > 0 ? '#2e7d32' : summary.diff < 0 ? '#d32f2f' : undefined }}>
                {summary.diff > 0 ? '+' : ''}{formatNumber(summary.diff)} ({summary.diff > 0 ? '+' : ''}{summary.pct.toFixed(2)}%)
              </strong>
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' } }}>No data in selected period.</Typography>
        )}
      </Paper>

      <AssetAllocationModal
        open={createOpen}
        onClose={handleCreateClose}
        onSubmit={handleCreateSubmit}
        form={createForm}
        setForm={setCreateForm}
        title="Add Asset Allocation"
        assetClasses={assetClasses}
      />
      <AssetAllocationModal
        open={editOpen}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
        form={editForm}
        setForm={setEditForm}
        title="Edit Asset Allocation"
        assetClasses={assetClasses}
      />

      <Paper sx={{ width: '100%' }}>
        <TableContainer
          sx={{
            overflowX: 'auto',
            maxWidth: '100%',
            '&::-webkit-scrollbar': {
              height: '6px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '3px',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.5)',
              },
            },
          }}
        >
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: { xs: 340, sm: 500, md: 600, lg: 700 },
              width: '100%',
              fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
              '& th, & td': {
                px: { xs: 0.125, sm: 0.5, md: 1, lg: 1.5 },
                py: { xs: 0.375, sm: 0.75, md: 0.875, lg: 1 },
                fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
                whiteSpace: { xs: 'nowrap', sm: 'normal' },
                maxWidth: { xs: 60, sm: 'none' },
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ minWidth: { xs: 30, sm: 45, md: 50 }, width: { xs: 30, sm: 45, md: 50 } }}>
                  <span style={{ fontSize: '0.78em' }}></span>
                </TableCell>
                <TableCell align="center" sx={{ minWidth: { xs: 40, sm: 75, md: 85, lg: 95 }, width: { xs: 50, sm: 75, md: 85, lg: 95 } }}>
                  <TableSortLabel
                    active={sortBy === 'date'}
                    direction={sortBy === 'date' ? sortOrder : 'asc'}
                    onClick={() => handleSort('date')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Date</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: { xs: 45, sm: 90, md: 105, lg: 120 }, width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                  <TableSortLabel
                    active={sortBy === 'totalValue'}
                    direction={sortBy === 'totalValue' ? sortOrder : 'asc'}
                    onClick={() => handleSort('totalValue')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Total Value</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: { xs: 45, sm: 90, md: 105, lg: 120 }, width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                  <TableSortLabel
                    active={sortBy === 'totalGain'}
                    direction={sortBy === 'totalGain' ? sortOrder : 'asc'}
                    onClick={() => handleSort('totalGain')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Gain</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: { xs: 45, sm: 90, md: 105, lg: 120 }, width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                  <TableSortLabel
                    active={sortBy === 'change'}
                    direction={sortBy === 'change' ? sortOrder : 'asc'}
                    onClick={() => handleSort('change')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Change</span>
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading...</TableCell>
                </TableRow>
              ) : sortedGroupedAllocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No asset allocations found.</TableCell>
                </TableRow>
              ) : (
                sortedGroupedAllocations.map((group) => {
                  const dateKey = getDateKey(group.date);
                  const isExpanded = expandedRows.has(dateKey);
                  
                  // Calculate change from previous chronological allocation
                  const chronoIndex = chronoSortedAllocations.findIndex(item => item.date.getTime() === group.date.getTime());
                  const prevChronoGroup = chronoIndex > 0 ? chronoSortedAllocations[chronoIndex - 1] : null;
                  const change = prevChronoGroup ? group.totalValue - prevChronoGroup.totalValue : null;
                  
                  return (
                    <React.Fragment key={dateKey}>
                      {/* Main row with totals */}
                      <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ width: { xs: 30, sm: 45, md: 50 } }}>
                          <IconButton
                            size="small"
                            onClick={() => handleRowExpand(dateKey)}
                            sx={{ p: { xs: 0.125, sm: 0.5 } }}
                          >
                            {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                          </IconButton>
                        </TableCell>
                        <TableCell align="center" sx={{ width: { xs: 50, sm: 75, md: 85, lg: 95 } }}>
                          {formatDate(group.date)}
                        </TableCell>
                        <TableCell align="right" sx={{ width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                          {formatNumber(group.totalValue)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: group.totalGain >= 0 ? 'success.main' : 'error.main', width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                          {formatNumber(group.totalGain)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: change !== null && change >= 0 ? 'success.main' : change !== null && change < 0 ? 'error.main' : 'text.secondary', width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                          {change !== null ? (change >= 0 ? '+' : '') + formatNumber(change) : '-'}
                        </TableCell>
                      </TableRow>

                      {/* Expandable row with individual allocations */}
                      <TableRow>
                        <TableCell colSpan={5} sx={{ py: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' } }}>
                                Individual Allocations:
                              </Typography>
                              <Table size="small" sx={{ minWidth: { xs: 280, sm: 400, md: 'auto' } }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 70, sm: 90, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Asset Class</TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 50, sm: 70, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Value</TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 40, sm: 60, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Gain</TableCell>
                                    <TableCell align="center" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 50, sm: 70, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {[...group.allocations].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0)).map((allocation: AssetAllocation) => (
                                    <TableRow key={allocation._id} sx={{ backgroundColor: 'grey.50' }}>
                                      <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 } }}>
                                        {getAssetClassName(allocation)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 } }}>
                                        {formatNumber(allocation.totalValue)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 }, color: (allocation.gain || 0) >= 0 ? 'success.main' : 'error.main' }}>
                                        {formatNumber(allocation.gain)}
                                      </TableCell>
                                      <TableCell align="center" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 } }}>
                                        <Box sx={{ display: 'flex', gap: { xs: 0.125, sm: 0.5 }, justifyContent: 'center' }}>
                                          <Button color="primary" size="small" onClick={() => handleEditOpen(allocation)} sx={{ minWidth: 'auto', p: { xs: 0.25, sm: 0.5 } }}>
                                            <EditIcon fontSize="small" />
                                          </Button>
                                          <Button color="error" size="small" onClick={() => handleDeleteClick(allocation._id)} sx={{ minWidth: 'auto', p: { xs: 0.25, sm: 0.5 } }}>
                                            <DeleteIcon fontSize="small" />
                                          </Button>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <ConfirmationModal
        open={deleteConfirmOpen}
        title="Delete Asset Allocation"
        message="Are you sure you want to delete this asset allocation?"
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Error display */}
      {error && (
        <Snackbar
          open={true}
          autoHideDuration={6000}
          onClose={() => {}} // Error persists until page reload
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" sx={{ width: '100%' }}>
            Failed to load asset allocations. Please try refreshing the page.
          </Alert>
        </Snackbar>
      )}

      {/* Success/Error notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
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

export default AssetAllocationPage;